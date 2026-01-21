export interface DocumentSection {
  type: 'summary' | 'argument' | 'quote' | 'text' | 'tension'
  title?: string
  content: string
  marginNote?: string
}

export interface DocumentContent {
  id: string
  filename: string
  sections: DocumentSection[]
}
