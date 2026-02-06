// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cdg;
mod session;
mod terminal;
mod watcher;
mod context;
mod obsidian;
mod documents;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Initialize app data directory structure on first run
            if let Err(e) = session::init_app_data_dir(app.handle()) {
                eprintln!("Failed to initialize app data directory: {}", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Session commands
            session::create_session,
            session::load_session,
            session::save_session,
            session::list_sessions,
            session::delete_session,
            session::get_app_data_dir,
            session::get_skills_dir,
            // Terminal commands
            terminal::spawn_terminal,
            terminal::write_to_terminal,
            terminal::resize_terminal,
            terminal::kill_terminal,
            terminal::get_terminal_state,
            // Watcher commands
            watcher::watch_session,
            watcher::unwatch_session,
            // Context commands
            context::tokens::context_count_tokens,
            context::tokens::context_count_tokens_batch,
            context::tokens::context_estimate_tokens,
            context::classification::context_get_allocation,
            context::classification::context_classify_session,
            context::budget::context_get_budget_constants,
            context::compression::context_check_compression_triggers,
            context::compression::context_create_compression_request,
            // Obsidian commands
            obsidian::indexer::obsidian_configure_vault,
            obsidian::indexer::obsidian_index_vault,
            obsidian::indexer::obsidian_get_stats,
            obsidian::query::obsidian_resolve_mention,
            obsidian::query::obsidian_query_notes,
            obsidian::query::obsidian_get_note_content,
            obsidian::query::obsidian_get_related_notes,
            obsidian::watcher::obsidian_start_watching,
            obsidian::watcher::obsidian_stop_watching,
            obsidian::watcher::obsidian_is_watching,
            obsidian::watcher::obsidian_get_watched_path,
            // Document commands
            documents::chunker::documents_list_directory,
            documents::chunker::documents_determine_handling,
            documents::chunker::documents_chunk_document,
            documents::embeddings::documents_generate_embedding,
            documents::embeddings::documents_cosine_similarity,
            documents::embeddings::documents_cache_embedding,
            documents::embeddings::documents_get_cached_embedding,
            documents::retriever::documents_add_reference,
            documents::retriever::documents_remove_reference,
            documents::retriever::documents_list_references,
            documents::retriever::documents_search_document,
            documents::retriever::documents_search_all,
            documents::retriever::documents_get_chunk,
            documents::retriever::documents_clear_ephemeral,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
