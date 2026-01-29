/**
 * Folder Picker
 *
 * Uses Tauri's dialog plugin to open a native folder picker.
 */

import { open } from '@tauri-apps/plugin-dialog'

export interface FolderSelection {
  path: string
  name: string
}

/**
 * Open a native folder picker dialog.
 * Returns the selected folder path and name, or null if cancelled.
 */
export async function pickFolder(): Promise<FolderSelection | null> {
  try {
    const selected = await open({
      directory: true,
      title: 'Select Working Directory',
    })

    if (!selected || typeof selected !== 'string') {
      return null
    }

    // Extract folder name from path
    const name = selected.split('/').pop() || 'Project'

    return { path: selected, name }
  } catch (error) {
    console.error('Failed to open folder picker:', error)
    return null
  }
}
