//! Document Chunking
//!
//! Splits documents into semantic chunks for embedding and retrieval.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use thiserror::Error;

/// Token thresholds for document handling strategies
pub const THRESHOLD_FULL: u32 = 4_000;       // Load fully
pub const THRESHOLD_SUMMARIZE: u32 = 20_000; // Summary + section index
// Above 20K: chunk and embed

/// Target chunk size in tokens
pub const CHUNK_SIZE_TARGET: u32 = 500;

/// Maximum file size (50 MB) allowed for chunking.
const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;

#[derive(Error, Debug)]
pub enum ChunkerError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Unsupported file type: {0}")]
    UnsupportedType(String),
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("File too large: {0} bytes (max {1} bytes)")]
    FileTooLarge(u64, u64),
}

impl Serialize for ChunkerError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Document handling strategy based on size
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DocumentHandling {
    /// Document loaded fully (< 4K tokens)
    Full,
    /// Summary + section index, retrieve on demand (4K-20K tokens)
    Summarized,
    /// Chunked and embedded for retrieval (> 20K tokens)
    Chunked,
}

/// Document persistence strategy
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DocumentPersistence {
    /// Discarded after session (Quick mode)
    Ephemeral,
    /// Cached for session duration (Decision mode)
    Cached,
    /// Permanently linked to thesis (Thesis mode)
    Permanent,
}

/// A chunk of a document
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Chunk {
    /// Chunk index within document
    pub index: u32,
    /// Content of the chunk
    pub content: String,
    /// Start position in original document (chars)
    pub start_pos: usize,
    /// End position in original document (chars)
    pub end_pos: usize,
    /// Estimated token count
    pub token_count: u32,
    /// Section heading if available
    pub section: Option<String>,
}

/// Document with metadata and optional chunks
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkedDocument {
    pub id: String,
    pub filename: String,
    pub path: String,
    pub total_tokens: u32,
    pub handling: DocumentHandling,
    pub chunks: Vec<Chunk>,
    /// Summary for summarized documents
    pub summary: Option<String>,
    /// Section index for navigation
    pub sections: Vec<SectionIndex>,
}

/// Section index entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SectionIndex {
    pub heading: String,
    pub level: u8,
    pub start_chunk: u32,
    pub token_count: u32,
}

/// Determine handling strategy for a document
pub fn determine_handling(token_count: u32) -> DocumentHandling {
    if token_count <= THRESHOLD_FULL {
        DocumentHandling::Full
    } else if token_count <= THRESHOLD_SUMMARIZE {
        DocumentHandling::Summarized
    } else {
        DocumentHandling::Chunked
    }
}

/// Chunk a document based on its content type
pub fn chunk_document(path: &Path, doc_id: &str) -> Result<ChunkedDocument, ChunkerError> {
    let file_size = fs::metadata(path)?.len();
    if file_size > MAX_FILE_SIZE {
        return Err(ChunkerError::FileTooLarge(file_size, MAX_FILE_SIZE));
    }
    let content = fs::read_to_string(path)?;
    let filename = path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let extension = path.extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    // Estimate tokens (byte-based; overestimates for non-ASCII/multi-byte text)
    let total_tokens = (content.len() as f64 / 4.0).ceil() as u32;
    let handling = determine_handling(total_tokens);

    // For full documents, just return as single chunk
    if handling == DocumentHandling::Full {
        return Ok(ChunkedDocument {
            id: doc_id.to_string(),
            filename,
            path: path.to_string_lossy().to_string(),
            total_tokens,
            handling,
            chunks: vec![Chunk {
                index: 0,
                content: content.clone(),
                start_pos: 0,
                end_pos: content.len(),
                token_count: total_tokens,
                section: None,
            }],
            summary: None,
            sections: Vec::new(),
        });
    }

    // Chunk based on content type
    let (chunks, sections) = match extension.as_str() {
        "md" | "markdown" => chunk_markdown(&content),
        "txt" => chunk_plain_text(&content),
        "py" | "rs" | "ts" | "js" | "tsx" | "jsx" => chunk_code(&content),
        _ => chunk_plain_text(&content), // Default to plain text
    };

    Ok(ChunkedDocument {
        id: doc_id.to_string(),
        filename,
        path: path.to_string_lossy().to_string(),
        total_tokens,
        handling,
        chunks,
        summary: None, // Populated by LLM later
        sections,
    })
}

/// Chunk markdown content by headers
fn chunk_markdown(content: &str) -> (Vec<Chunk>, Vec<SectionIndex>) {
    let mut chunks = Vec::new();
    let mut sections = Vec::new();
    let mut current_section: Option<String> = None;
    let mut current_chunk = String::new();
    let mut current_start = 0usize;
    let mut chunk_index = 0u32;
    let mut pos = 0usize;
    let content_bytes = content.as_bytes();

    for line in content.lines() {
        let line_start = pos;
        pos += line.len();
        // Only add 1 for newline if there actually is one at this position
        if pos < content_bytes.len() && content_bytes[pos] == b'\n' {
            pos += 1;
        }

        // Check if this is a header
        if line.starts_with('#') {
            // Save current chunk if not empty
            if !current_chunk.trim().is_empty() {
                let token_count = (current_chunk.len() as f64 / 4.0).ceil() as u32;
                chunks.push(Chunk {
                    index: chunk_index,
                    content: current_chunk.clone(),
                    start_pos: current_start,
                    end_pos: line_start,
                    token_count,
                    section: current_section.clone(),
                });
                chunk_index += 1;
            }

            // Extract header level and text
            let level = line.chars().take_while(|c| *c == '#').count() as u8;
            let heading = line.trim_start_matches('#').trim().to_string();

            sections.push(SectionIndex {
                heading: heading.clone(),
                level,
                start_chunk: chunk_index,
                token_count: 0, // Updated later
            });

            current_section = Some(heading);
            current_chunk = String::new();
            current_start = line_start;
        }

        current_chunk.push_str(line);
        current_chunk.push('\n');

        // Check if chunk exceeds target size
        let token_estimate = (current_chunk.len() as f64 / 4.0).ceil() as u32;
        if token_estimate >= CHUNK_SIZE_TARGET {
            // Try to split at paragraph boundary
            if let Some(split_pos) = find_paragraph_boundary(&current_chunk) {
                let (first, rest) = current_chunk.split_at(split_pos);
                let first_tokens = (first.len() as f64 / 4.0).ceil() as u32;

                chunks.push(Chunk {
                    index: chunk_index,
                    content: first.to_string(),
                    start_pos: current_start,
                    end_pos: current_start + split_pos,
                    token_count: first_tokens,
                    section: current_section.clone(),
                });

                chunk_index += 1;
                current_start += split_pos;
                current_chunk = rest.to_string();
            }
        }
    }

    // Save final chunk
    if !current_chunk.trim().is_empty() {
        let token_count = (current_chunk.len() as f64 / 4.0).ceil() as u32;
        chunks.push(Chunk {
            index: chunk_index,
            content: current_chunk,
            start_pos: current_start,
            end_pos: content.len(),
            token_count,
            section: current_section,
        });
    }

    // Update section token counts
    for section in &mut sections {
        let section_tokens: u32 = chunks.iter()
            .skip(section.start_chunk as usize)
            .take_while(|c| c.section.as_ref() == Some(&section.heading))
            .map(|c| c.token_count)
            .sum();
        section.token_count = section_tokens;
    }

    (chunks, sections)
}

/// Chunk plain text by paragraphs
fn chunk_plain_text(content: &str) -> (Vec<Chunk>, Vec<SectionIndex>) {
    let mut chunks = Vec::new();
    let mut current_chunk = String::new();
    let mut current_start = 0usize;
    let mut chunk_index = 0u32;

    let paragraphs: Vec<&str> = content.split("\n\n").collect();
    // Compute byte offset of each paragraph within content
    let mut para_offsets: Vec<usize> = Vec::with_capacity(paragraphs.len());
    let mut offset = 0usize;
    for (i, para) in paragraphs.iter().enumerate() {
        para_offsets.push(offset);
        offset += para.len();
        if i < paragraphs.len() - 1 {
            offset += 2; // account for the "\n\n" separator
        }
    }

    for (i, paragraph) in paragraphs.iter().enumerate() {
        // Check if adding this paragraph exceeds target
        let added_len = if current_chunk.is_empty() { paragraph.len() } else { paragraph.len() + 2 };
        let potential_tokens = ((current_chunk.len() + added_len) as f64 / 4.0).ceil() as u32;

        if potential_tokens > CHUNK_SIZE_TARGET && !current_chunk.is_empty() {
            // Save current chunk — end_pos is the start of this paragraph
            let token_count = (current_chunk.len() as f64 / 4.0).ceil() as u32;
            chunks.push(Chunk {
                index: chunk_index,
                content: current_chunk.clone(),
                start_pos: current_start,
                end_pos: para_offsets[i],
                token_count,
                section: None,
            });

            chunk_index += 1;
            current_start = para_offsets[i];
            current_chunk = String::new();
        }

        if !current_chunk.is_empty() {
            current_chunk.push_str("\n\n");
        }
        current_chunk.push_str(paragraph);
    }

    // Save final chunk
    if !current_chunk.trim().is_empty() {
        let token_count = (current_chunk.len() as f64 / 4.0).ceil() as u32;
        chunks.push(Chunk {
            index: chunk_index,
            content: current_chunk,
            start_pos: current_start,
            end_pos: content.len(),
            token_count,
            section: None,
        });
    }

    (chunks, Vec::new())
}

/// Chunk code by functions/classes
fn chunk_code(content: &str) -> (Vec<Chunk>, Vec<SectionIndex>) {
    // Simple approach: chunk by blank line groups
    // A more sophisticated approach would use tree-sitter
    let mut chunks = Vec::new();
    let sections = Vec::new();
    let mut current_chunk = String::new();
    let mut current_start = 0usize;
    let mut chunk_index = 0u32;
    let mut blank_count = 0;
    let mut pos = 0usize;

    for line in content.lines() {
        let line_len = line.len() + 1;

        if line.trim().is_empty() {
            blank_count += 1;
        } else {
            // If we hit 2+ blank lines and have content, consider splitting
            if blank_count >= 2 && !current_chunk.is_empty() {
                let token_estimate = (current_chunk.len() as f64 / 4.0).ceil() as u32;
                if token_estimate >= CHUNK_SIZE_TARGET / 2 {
                    chunks.push(Chunk {
                        index: chunk_index,
                        content: current_chunk.clone(),
                        start_pos: current_start,
                        end_pos: pos,
                        token_count: token_estimate,
                        section: None,
                    });
                    chunk_index += 1;
                    current_start = pos;
                    current_chunk = String::new();
                }
            }
            blank_count = 0;
        }

        current_chunk.push_str(line);
        current_chunk.push('\n');
        pos += line_len;

        // Force split at target size
        let token_estimate = (current_chunk.len() as f64 / 4.0).ceil() as u32;
        if token_estimate >= CHUNK_SIZE_TARGET {
            chunks.push(Chunk {
                index: chunk_index,
                content: current_chunk.clone(),
                start_pos: current_start,
                end_pos: pos,
                token_count: token_estimate,
                section: None,
            });
            chunk_index += 1;
            current_start = pos;
            current_chunk = String::new();
        }
    }

    // Save final chunk
    if !current_chunk.trim().is_empty() {
        let token_count = (current_chunk.len() as f64 / 4.0).ceil() as u32;
        chunks.push(Chunk {
            index: chunk_index,
            content: current_chunk,
            start_pos: current_start,
            end_pos: content.len(),
            token_count,
            section: None,
        });
    }

    (chunks, sections)
}

/// Find a good paragraph boundary for splitting
fn find_paragraph_boundary(text: &str) -> Option<usize> {
    // Look for \n\n in the latter half of the text
    let mid = text.len() / 2;
    text[mid..].find("\n\n").map(|pos| mid + pos + 2)
}

/// A file or directory entry for the file tree UI
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Vec<FileEntry>,
}

/// Supported text file extensions for the document viewer
const SUPPORTED_EXTENSIONS: &[&str] = &[
    "md", "markdown", "txt", "rs", "ts", "tsx", "js", "jsx", "py", "json",
    "yaml", "yml", "toml", "css", "html", "htm", "csv", "sh", "bash", "zsh",
    "swift", "go", "java", "c", "cpp", "h", "hpp", "rb", "lua", "sql",
    "xml", "svg", "env", "gitignore", "dockerfile",
];

/// Maximum recursion depth for directory listing.
const MAX_LIST_DEPTH: u32 = 10;

/// Recursively list a directory, filtering to supported text files.
/// Stops recursing when `remaining_depth` reaches 0.
fn list_directory_inner(dir: &Path, remaining_depth: u32) -> Result<Vec<FileEntry>, ChunkerError> {
    if remaining_depth == 0 {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();

    let read_dir = fs::read_dir(dir)?;
    for entry in read_dir {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/directories
        if name.starts_with('.') {
            continue;
        }

        let path = entry.path();
        let metadata = entry.metadata()?;

        if metadata.is_dir() {
            // Recurse into subdirectories
            let children = list_directory_inner(&path, remaining_depth - 1)?;
            // Only include directories that have visible children
            if !children.is_empty() {
                entries.push(FileEntry {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_directory: true,
                    children,
                });
            }
        } else if metadata.is_file() {
            // Check extension against supported list
            let ext = path.extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            // Also include extensionless files that might be config (Dockerfile, Makefile, etc.)
            let has_supported_ext = SUPPORTED_EXTENSIONS.contains(&ext.as_str());
            let is_known_extensionless = matches!(name.as_str(),
                "Makefile" | "Dockerfile" | "Rakefile" | "Gemfile" | "LICENSE" | "README"
            );
            if has_supported_ext || is_known_extensionless {
                entries.push(FileEntry {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_directory: false,
                    children: Vec::new(),
                });
            }
        }
    }

    // Sort: directories first, then alphabetical
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

// ============ TAURI COMMANDS ============

#[tauri::command]
pub fn documents_list_directory(path: String) -> Result<Vec<FileEntry>, ChunkerError> {
    let canonical = Path::new(&path).canonicalize()
        .map_err(ChunkerError::Io)?;
    if let Some(home) = dirs::home_dir() {
        if !canonical.starts_with(&home) {
            return Err(ChunkerError::Io(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "Path must be within home directory",
            )));
        }
    }
    list_directory_inner(&canonical, MAX_LIST_DEPTH)
}

#[tauri::command]
pub fn documents_determine_handling(token_count: u32) -> DocumentHandling {
    determine_handling(token_count)
}

#[tauri::command]
pub fn documents_chunk_document(path: String, doc_id: String) -> Result<ChunkedDocument, ChunkerError> {
    // Canonicalize and validate the path is under the user's home directory
    let canonical = Path::new(&path).canonicalize()
        .map_err(ChunkerError::Io)?;
    if let Some(home) = dirs::home_dir() {
        if !canonical.starts_with(&home) {
            return Err(ChunkerError::Io(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "Path must be within home directory",
            )));
        }
    }
    chunk_document(&canonical, &doc_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_determine_handling() {
        assert_eq!(determine_handling(1000), DocumentHandling::Full);
        assert_eq!(determine_handling(5000), DocumentHandling::Summarized);
        assert_eq!(determine_handling(30000), DocumentHandling::Chunked);
    }

    #[test]
    fn test_chunk_markdown_headers() {
        let content = "# Header 1\n\nContent under 1.\n\n## Header 2\n\nContent under 2.";
        let (chunks, sections) = chunk_markdown(content);

        assert!(!chunks.is_empty());
        assert_eq!(sections.len(), 2);
        assert_eq!(sections[0].heading, "Header 1");
        assert_eq!(sections[0].level, 1);
        assert_eq!(sections[1].heading, "Header 2");
        assert_eq!(sections[1].level, 2);
    }

    #[test]
    fn test_chunk_plain_text() {
        let content = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
        let (chunks, _) = chunk_plain_text(content);

        // With small content, should be one chunk
        assert_eq!(chunks.len(), 1);
    }

    #[test]
    fn test_chunk_plain_text_positions() {
        let content = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
        let (chunks, _) = chunk_plain_text(content);

        assert_eq!(chunks.len(), 1);
        let chunk = &chunks[0];
        assert_eq!(chunk.start_pos, 0);
        assert_eq!(chunk.end_pos, content.len());
        // Verify the chunk content matches the original via positions
        assert_eq!(&content[chunk.start_pos..chunk.end_pos], &chunk.content);
    }

    #[test]
    fn test_chunk_markdown_no_trailing_newline() {
        let content = "# Title\n\nSome text";
        let (chunks, _) = chunk_markdown(content);

        assert!(!chunks.is_empty());
        let last = chunks.last().unwrap();
        // end_pos must not exceed content length
        assert!(last.end_pos <= content.len());
    }
}
