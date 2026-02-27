//! Chroma HTTP Client
//!
//! Direct HTTP client for Chroma's REST API. Uses reqwest instead of
//! third-party wrapper crates for stability and full API control.
//! Supports both v1 and v2 API versions with automatic detection.

use parking_lot::RwLock;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::OnceLock;
use std::time::Duration;
use thiserror::Error;
use tracing::{info, warn, error, debug};

use super::sidecar::CHROMA_PORT;
use crate::documents::embeddings::generate_embedding;

#[derive(Error, Debug)]
pub enum ChromaError {
    #[error("Chroma HTTP error: {0}")]
    Http(String),
    #[error("Collection not found: {0}")]
    CollectionNotFound(String),
    #[error("Chroma server not available")]
    ServerUnavailable,
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    #[error("Deserialization error: {0}")]
    Deserialize(String),
}

impl Serialize for ChromaError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<reqwest::Error> for ChromaError {
    fn from(e: reqwest::Error) -> Self {
        ChromaError::Http(e.to_string())
    }
}

/// Chroma collection info returned by API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionInfo {
    pub id: String,
    pub name: String,
    pub metadata: Option<Value>,
}

/// Result from a query operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChromaQueryResult {
    pub ids: Vec<Vec<String>>,
    pub documents: Option<Vec<Vec<Option<String>>>>,
    pub metadatas: Option<Vec<Vec<Option<Value>>>>,
    pub distances: Option<Vec<Vec<f32>>>,
}

/// Result from a get operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChromaGetResult {
    pub ids: Vec<String>,
    pub documents: Option<Vec<Option<String>>>,
    pub metadatas: Option<Vec<Option<Value>>>,
    pub embeddings: Option<Vec<Vec<f32>>>,
}

/// Detected API version prefix, shared across all client instances
static DETECTED_API_PREFIX: OnceLock<String> = OnceLock::new();

/// Chroma HTTP client
#[derive(Clone)]
pub struct ChromaClient {
    http: Client,
    base_url: String,
    tenant: String,
    database: String,
}

/// Global client instance
static CLIENT: RwLock<Option<ChromaClient>> = RwLock::new(None);

impl ChromaClient {
    pub fn new(base_url: &str) -> Self {
        let http = Client::builder()
            .timeout(Duration::from_secs(30))
            .connect_timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            http,
            base_url: base_url.trim_end_matches('/').to_string(),
            tenant: "default_tenant".to_string(),
            database: "default_database".to_string(),
        }
    }

    /// Get the API prefix. Callers must call ensure_api_detected() first.
    fn api_prefix(&self) -> &str {
        DETECTED_API_PREFIX.get()
            .map(|s| s.as_str())
            .expect("BUG: api_prefix() called before ensure_api_detected()")
    }

    /// Ensure API version is detected, running detection if needed.
    /// Call this before any operation that needs the API prefix.
    pub async fn ensure_api_detected(&self) -> Result<(), ChromaError> {
        if DETECTED_API_PREFIX.get().is_none() {
            self.detect_api_version().await?;
        }
        Ok(())
    }

    /// Detect API version by probing heartbeat endpoints.
    /// Returns the working prefix ("/api/v2" or "/api/v1").
    pub async fn detect_api_version(&self) -> Result<String, ChromaError> {
        // If already detected, return cached
        if let Some(prefix) = DETECTED_API_PREFIX.get() {
            return Ok(prefix.clone());
        }

        // Try v2 first
        debug!("Probing Chroma API v2 heartbeat");
        match self.http.get(format!("{}/api/v2/heartbeat", self.base_url))
            .timeout(Duration::from_secs(5))
            .send().await
        {
            Ok(resp) if resp.status().is_success() => {
                let prefix = "/api/v2".to_string();
                let _ = DETECTED_API_PREFIX.set(prefix.clone());
                info!(prefix = %prefix, "Detected Chroma API version");
                return Ok(prefix);
            }
            Ok(resp) => {
                debug!(status = %resp.status(), "Chroma v2 heartbeat returned non-success");
            }
            Err(e) => {
                debug!(error = %e, "Chroma v2 heartbeat probe failed");
            }
        }

        // Fall back to v1
        debug!("Probing Chroma API v1 heartbeat");
        match self.http.get(format!("{}/api/v1/heartbeat", self.base_url))
            .timeout(Duration::from_secs(5))
            .send().await
        {
            Ok(resp) if resp.status().is_success() => {
                let prefix = "/api/v1".to_string();
                let _ = DETECTED_API_PREFIX.set(prefix.clone());
                info!(prefix = %prefix, "Detected Chroma API version");
                return Ok(prefix);
            }
            Ok(resp) => {
                debug!(status = %resp.status(), "Chroma v1 heartbeat returned non-success");
            }
            Err(e) => {
                debug!(error = %e, "Chroma v1 heartbeat probe failed");
            }
        }

        Err(ChromaError::ServerUnavailable)
    }

    /// Build the tenant/database path segment
    fn td_path(&self) -> String {
        format!("tenants/{}/databases/{}", self.tenant, self.database)
    }

    /// Health check — returns nanosecond heartbeat if healthy
    pub async fn heartbeat(&self) -> Result<i64, ChromaError> {
        // Detect version on first heartbeat call
        let prefix = self.detect_api_version().await?;

        let url = format!("{}{}/heartbeat", self.base_url, prefix);
        debug!(url = %url, "Chroma heartbeat check");
        let resp = self.http.get(&url).send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            debug!(status = %status, body = %body, "Heartbeat failed");
            return Err(ChromaError::ServerUnavailable);
        }

        let body: Value = resp.json().await?;
        Ok(body["nanosecond heartbeat"].as_i64().unwrap_or(0))
    }

    /// Get or create a collection by name
    pub async fn get_or_create_collection(
        &self,
        name: &str,
        metadata: Option<Value>,
    ) -> Result<CollectionInfo, ChromaError> {
        self.ensure_api_detected().await?;
        let mut body = json!({
            "name": name,
            "get_or_create": true,
        });
        if let Some(meta) = metadata {
            body["metadata"] = meta;
        }

        let url = format!("{}{}/{}/collections",
            self.base_url, self.api_prefix(), self.td_path()
        );

        let resp = self.http.post(&url)
            .json(&body)
            .send().await?;

        let status = resp.status();
        let text = resp.text().await?;

        if !status.is_success() {
            error!(name = %name, status = %status, "Collection get_or_create failed");
            return Err(ChromaError::Http(format!("Create collection failed ({}): {}", status, text)));
        }

        info!(name = %name, "Collection get_or_create");
        serde_json::from_str(&text)
            .map_err(|e| ChromaError::Deserialize(format!("{}: {}", e, text)))
    }

    /// Get a collection by name (read-only, does not create)
    pub async fn get_collection(&self, name: &str) -> Result<CollectionInfo, ChromaError> {
        let collections = self.list_collections().await?;
        collections.into_iter()
            .find(|c| c.name == name)
            .ok_or_else(|| ChromaError::CollectionNotFound(name.to_string()))
    }

    /// Delete a collection by name
    pub async fn delete_collection(&self, name: &str) -> Result<(), ChromaError> {
        self.ensure_api_detected().await?;
        let url = format!("{}{}/{}/collections/{}",
            self.base_url, self.api_prefix(), self.td_path(), name
        );

        let resp = self.http.delete(&url).send().await?;

        if resp.status().as_u16() == 404 {
            warn!(name = %name, "Collection already deleted (404)");
            Ok(())
        } else if resp.status().is_success() {
            info!(name = %name, "Deleted collection");
            Ok(())
        } else {
            Err(ChromaError::Http(format!("Delete collection failed: {}", resp.status())))
        }
    }

    /// List all collections
    pub async fn list_collections(&self) -> Result<Vec<CollectionInfo>, ChromaError> {
        self.ensure_api_detected().await?;
        let url = format!("{}{}/{}/collections",
            self.base_url, self.api_prefix(), self.td_path()
        );

        let resp = self.http.get(&url).send().await?;

        if !resp.status().is_success() {
            return Err(ChromaError::Http(format!("List collections failed: {}", resp.status())));
        }

        resp.json().await.map_err(|e| ChromaError::Deserialize(e.to_string()))
    }

    /// Add records to a collection
    pub async fn add(
        &self,
        collection_id: &str,
        ids: Vec<String>,
        documents: Option<Vec<String>>,
        embeddings: Option<Vec<Vec<f32>>>,
        metadatas: Option<Vec<Value>>,
    ) -> Result<(), ChromaError> {
        if ids.is_empty() {
            return Err(ChromaError::InvalidInput("ids cannot be empty".to_string()));
        }

        let mut body = json!({ "ids": ids });
        if let Some(docs) = documents {
            body["documents"] = json!(docs);
        }
        if let Some(embs) = embeddings {
            body["embeddings"] = json!(embs);
        }
        if let Some(metas) = metadatas {
            body["metadatas"] = json!(metas);
        }

        let count = ids.len();
        self.ensure_api_detected().await?;
        let url = format!("{}{}/{}/collections/{}/add",
            self.base_url, self.api_prefix(), self.td_path(), collection_id
        );

        let resp = self.http.post(&url)
            .json(&body)
            .send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            error!(status = %status, body = %text, "Chroma HTTP error");
            return Err(ChromaError::Http(format!("Add failed: {}", text)));
        }

        info!(collection = %collection_id, count = count, "Added documents");
        Ok(())
    }

    /// Upsert records (insert or update)
    pub async fn upsert(
        &self,
        collection_id: &str,
        ids: Vec<String>,
        documents: Option<Vec<String>>,
        embeddings: Option<Vec<Vec<f32>>>,
        metadatas: Option<Vec<Value>>,
    ) -> Result<(), ChromaError> {
        if ids.is_empty() {
            return Err(ChromaError::InvalidInput("ids cannot be empty".to_string()));
        }

        let mut body = json!({ "ids": ids });
        if let Some(docs) = documents {
            body["documents"] = json!(docs);
        }
        if let Some(embs) = embeddings {
            body["embeddings"] = json!(embs);
        }
        if let Some(metas) = metadatas {
            body["metadatas"] = json!(metas);
        }

        let count = ids.len();
        self.ensure_api_detected().await?;
        let url = format!("{}{}/{}/collections/{}/upsert",
            self.base_url, self.api_prefix(), self.td_path(), collection_id
        );

        let resp = self.http.post(&url)
            .json(&body)
            .send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            error!(status = %status, body = %text, "Chroma HTTP error");
            return Err(ChromaError::Http(format!("Upsert failed: {}", text)));
        }

        info!(collection = %collection_id, count = count, "Upserted documents");
        Ok(())
    }

    /// Query a collection using embeddings
    pub async fn query(
        &self,
        collection_id: &str,
        query_embeddings: Option<Vec<Vec<f32>>>,
        query_texts: Option<Vec<String>>,
        n_results: u32,
        where_filter: Option<Value>,
        where_document: Option<Value>,
        include: Option<Vec<String>>,
    ) -> Result<ChromaQueryResult, ChromaError> {
        let mut body = json!({ "n_results": n_results });

        if let Some(embs) = query_embeddings {
            body["query_embeddings"] = json!(embs);
        }
        if let Some(texts) = query_texts {
            body["query_texts"] = json!(texts);
        }
        if let Some(wf) = where_filter {
            body["where"] = wf;
        }
        if let Some(wd) = where_document {
            body["where_document"] = wd;
        }
        if let Some(inc) = include {
            body["include"] = json!(inc);
        }

        debug!(collection = %collection_id, n_results = n_results, "Querying collection");
        self.ensure_api_detected().await?;
        let url = format!("{}{}/{}/collections/{}/query",
            self.base_url, self.api_prefix(), self.td_path(), collection_id
        );

        let resp = self.http.post(&url)
            .json(&body)
            .send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            error!(status = %status, body = %text, "Chroma HTTP error");
            return Err(ChromaError::Http(format!("Query failed: {}", text)));
        }

        resp.json().await.map_err(|e| ChromaError::Deserialize(e.to_string()))
    }

    /// Get records by IDs or filter
    pub async fn get(
        &self,
        collection_id: &str,
        ids: Option<Vec<String>>,
        where_filter: Option<Value>,
        where_document: Option<Value>,
        limit: Option<u32>,
        offset: Option<u32>,
        include: Option<Vec<String>>,
    ) -> Result<ChromaGetResult, ChromaError> {
        let mut body = json!({});
        if let Some(id_list) = ids {
            body["ids"] = json!(id_list);
        }
        if let Some(wf) = where_filter {
            body["where"] = wf;
        }
        if let Some(wd) = where_document {
            body["where_document"] = wd;
        }
        if let Some(l) = limit {
            body["limit"] = json!(l);
        }
        if let Some(o) = offset {
            body["offset"] = json!(o);
        }
        if let Some(inc) = include {
            body["include"] = json!(inc);
        }

        self.ensure_api_detected().await?;
        let url = format!("{}{}/{}/collections/{}/get",
            self.base_url, self.api_prefix(), self.td_path(), collection_id
        );

        let resp = self.http.post(&url)
            .json(&body)
            .send().await?;

        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(ChromaError::Http(format!("Get failed: {}", text)));
        }

        resp.json().await.map_err(|e| ChromaError::Deserialize(e.to_string()))
    }

    /// Delete records by IDs or filter
    pub async fn delete(
        &self,
        collection_id: &str,
        ids: Option<Vec<String>>,
        where_filter: Option<Value>,
    ) -> Result<(), ChromaError> {
        let mut body = json!({});
        if let Some(id_list) = ids {
            body["ids"] = json!(id_list);
        }
        if let Some(wf) = where_filter {
            body["where"] = wf;
        }

        self.ensure_api_detected().await?;
        let url = format!("{}{}/{}/collections/{}/delete",
            self.base_url, self.api_prefix(), self.td_path(), collection_id
        );

        let resp = self.http.post(&url)
            .json(&body)
            .send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            error!(status = %status, body = %text, "Chroma HTTP error");
            return Err(ChromaError::Http(format!("Delete failed: {}", text)));
        }

        info!(collection = %collection_id, "Deleted from collection");
        Ok(())
    }

    /// Count records in a collection
    pub async fn count(&self, collection_id: &str) -> Result<u32, ChromaError> {
        self.ensure_api_detected().await?;
        let url = format!("{}{}/{}/collections/{}/count",
            self.base_url, self.api_prefix(), self.td_path(), collection_id
        );

        let resp = self.http.get(&url).send().await?;

        if !resp.status().is_success() {
            return Err(ChromaError::Http(format!("Count failed: {}", resp.status())));
        }

        let result: u32 = resp.json().await.map_err(|e| ChromaError::Deserialize(e.to_string()))?;
        debug!(collection = %collection_id, count = result, "Collection count");
        Ok(result)
    }
}

// ============ EMBEDDING HELPERS ============

/// Generate embeddings for a batch of document texts (for add/upsert).
/// Uses the local feature-hash embedder (256 dims, deterministic).
pub fn embed_documents(texts: &[String]) -> Vec<Vec<f32>> {
    texts.iter()
        .map(|t| generate_embedding(t).unwrap_or_else(|_| vec![0.0; 256]))
        .collect()
}

/// Generate embedding for a single query text (for query).
pub fn embed_query(text: &str) -> Vec<Vec<f32>> {
    vec![generate_embedding(text).unwrap_or_else(|_| vec![0.0; 256])]
}

/// Get the global Chroma client (creates on first access)
pub fn get_client() -> ChromaClient {
    {
        let client = CLIENT.read();
        if let Some(ref c) = *client {
            return c.clone();
        }
    }

    let mut client = CLIENT.write();
    if client.is_none() {
        *client = Some(ChromaClient::new(&format!("http://127.0.0.1:{}", CHROMA_PORT)));
    }
    client.as_ref().unwrap().clone()
}

/// Reset the client (e.g., if port changes)
pub fn reset_client() {
    let mut client = CLIENT.write();
    *client = None;
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub async fn chroma_health_check() -> Result<bool, ChromaError> {
    let client = get_client();
    match client.heartbeat().await {
        Ok(_) => Ok(true),
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub async fn chroma_list_collections() -> Result<Vec<String>, ChromaError> {
    let client = get_client();
    let collections = client.list_collections().await?;
    Ok(collections.into_iter().map(|c| c.name).collect())
}
