//! Chroma HTTP Client
//!
//! Direct HTTP client for Chroma's REST API. Uses reqwest instead of
//! third-party wrapper crates for stability and full API control.

use parking_lot::RwLock;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use thiserror::Error;
use tracing::{info, warn, error, debug};

use super::sidecar::CHROMA_PORT;

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

    /// Health check — returns nanosecond heartbeat if healthy
    pub async fn heartbeat(&self) -> Result<i64, ChromaError> {
        debug!("Chroma heartbeat check");
        let resp = self.http.get(format!("{}/api/v1/heartbeat", self.base_url))
            .send().await?;

        if !resp.status().is_success() {
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
        let mut body = json!({
            "name": name,
            "get_or_create": true,
        });
        if let Some(meta) = metadata {
            body["metadata"] = meta;
        }

        let resp = self.http.post(format!(
            "{}/api/v1/tenants/{}/databases/{}/collections",
            self.base_url, self.tenant, self.database
        ))
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
        let resp = self.http.delete(format!(
            "{}/api/v1/tenants/{}/databases/{}/collections/{}",
            self.base_url, self.tenant, self.database, name
        ))
            .send().await?;

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
        let resp = self.http.get(format!(
            "{}/api/v1/tenants/{}/databases/{}/collections",
            self.base_url, self.tenant, self.database
        ))
            .send().await?;

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
        let resp = self.http.post(format!(
            "{}/api/v1/collections/{}/add",
            self.base_url, collection_id
        ))
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
        let resp = self.http.post(format!(
            "{}/api/v1/collections/{}/upsert",
            self.base_url, collection_id
        ))
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
        let resp = self.http.post(format!(
            "{}/api/v1/collections/{}/query",
            self.base_url, collection_id
        ))
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

        let resp = self.http.post(format!(
            "{}/api/v1/collections/{}/get",
            self.base_url, collection_id
        ))
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

        let resp = self.http.post(format!(
            "{}/api/v1/collections/{}/delete",
            self.base_url, collection_id
        ))
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
        let resp = self.http.get(format!(
            "{}/api/v1/collections/{}/count",
            self.base_url, collection_id
        ))
            .send().await?;

        if !resp.status().is_success() {
            return Err(ChromaError::Http(format!("Count failed: {}", resp.status())));
        }

        let result: u32 = resp.json().await.map_err(|e| ChromaError::Deserialize(e.to_string()))?;
        debug!(collection = %collection_id, count = result, "Collection count");
        Ok(result)
    }
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
