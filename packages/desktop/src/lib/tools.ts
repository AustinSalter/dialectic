/**
 * Tool definitions and execution for Claude agent mode
 */

export interface Tool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, { type: string; description?: string }>
    required: string[]
  }
}

export const tools: Tool[] = [
  {
    name: 'read_file',
    description: 'Read contents of a file. In browser context, this reads from localStorage simulation.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The file path to read' }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file. In browser context, this writes to localStorage simulation.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The file path to write to' },
        content: { type: 'string', description: 'The content to write' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'search_files',
    description: 'Search for a pattern in files (grep-like). Limited in browser context.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'The search pattern (regex supported)' },
        path: { type: 'string', description: 'The directory path to search in' }
      },
      required: ['pattern']
    }
  },
  {
    name: 'list_files',
    description: 'List files in a directory. Limited in browser context.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The directory path to list' }
      },
      required: ['path']
    }
  },
  {
    name: 'web_fetch',
    description: 'Fetch content from a URL. May be limited by CORS in browser context.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch' }
      },
      required: ['url']
    }
  }
]

// LocalStorage-based file simulation
const FILE_STORAGE_KEY = 'dialectic_virtual_files'

interface VirtualFileSystem {
  [path: string]: string
}

function getVirtualFS(): VirtualFileSystem {
  try {
    const data = localStorage.getItem(FILE_STORAGE_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

function setVirtualFS(fs: VirtualFileSystem): void {
  localStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(fs))
}

/**
 * Execute a tool call and return the result
 */
export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case 'read_file': {
      const path = toolInput.path as string
      const fs = getVirtualFS()
      if (fs[path]) {
        return fs[path]
      }
      return `[Browser context] File not found in virtual filesystem: ${path}\n\nNote: File operations are simulated using localStorage. Real file system access requires Claude Code CLI.`
    }

    case 'write_file': {
      const path = toolInput.path as string
      const content = toolInput.content as string
      const fs = getVirtualFS()
      fs[path] = content
      setVirtualFS(fs)
      return `[Browser context] Written ${content.length} characters to virtual file: ${path}\n\nNote: This file is stored in localStorage, not the real filesystem.`
    }

    case 'search_files': {
      const pattern = toolInput.pattern as string
      const searchPath = toolInput.path as string || '/'
      const fs = getVirtualFS()
      const matches: string[] = []
      const regex = new RegExp(pattern, 'gi')

      for (const [filePath, content] of Object.entries(fs)) {
        if (filePath.startsWith(searchPath)) {
          const lines = content.split('\n')
          lines.forEach((line, idx) => {
            if (regex.test(line)) {
              matches.push(`${filePath}:${idx + 1}: ${line}`)
            }
          })
        }
      }

      if (matches.length > 0) {
        return `[Browser context] Found ${matches.length} matches:\n${matches.slice(0, 20).join('\n')}${matches.length > 20 ? `\n...and ${matches.length - 20} more` : ''}`
      }
      return `[Browser context] No matches found for pattern "${pattern}" in virtual filesystem.\n\nNote: Search is limited to localStorage-simulated files. Real file search requires Claude Code CLI.`
    }

    case 'list_files': {
      const listPath = toolInput.path as string || '/'
      const fs = getVirtualFS()
      const files = Object.keys(fs).filter(p => {
        if (listPath === '/') return true
        return p.startsWith(listPath)
      })

      if (files.length > 0) {
        return `[Browser context] Virtual files:\n${files.join('\n')}`
      }
      return `[Browser context] No files in virtual filesystem at path: ${listPath}\n\nNote: File listing is limited to localStorage-simulated files. Real file listing requires Claude Code CLI.`
    }

    case 'web_fetch': {
      const url = toolInput.url as string
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'text/html,application/json,text/plain'
          }
        })

        if (!response.ok) {
          return `Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`
        }

        const contentType = response.headers.get('content-type') || ''
        const text = await response.text()

        if (contentType.includes('application/json')) {
          try {
            const json = JSON.parse(text)
            return `JSON response from ${url}:\n${JSON.stringify(json, null, 2).slice(0, 5000)}`
          } catch {
            return text.slice(0, 5000)
          }
        }

        // For HTML, try to extract main text content
        if (contentType.includes('text/html')) {
          // Simple HTML to text conversion
          const textContent = text
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          return `Content from ${url} (text extracted):\n${textContent.slice(0, 5000)}`
        }

        return `Content from ${url}:\n${text.slice(0, 5000)}`
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        if (msg.includes('CORS') || msg.includes('Failed to fetch')) {
          return `[Browser context] Cannot fetch ${url}: CORS restriction or network error.\n\nNote: Many websites block cross-origin requests from browsers. The URL may still be valid - try accessing it directly.`
        }
        return `Failed to fetch ${url}: ${msg}`
      }
    }

    default:
      return `Unknown tool: ${toolName}`
  }
}
