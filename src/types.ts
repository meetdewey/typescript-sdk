// ── Collections ───────────────────────────────────────────────────────────────

export interface Collection {
  id: string
  projectId: string
  name: string
  visibility: 'private' | 'public'
  chunkSize: number
  chunkOverlap: number
  embeddingModel: string
  description: string | null
  descriptionDocCount: number | null
  enableSummarization: boolean
  enableCaptioning: boolean
  llmModel: string | null
  lastSummarizationModel: string | null
  lastCaptioningModel: string | null
  instructions: string | null
  createdAt: string
  deletedAt: string | null
}

export interface CreateCollectionInput {
  name: string
  visibility?: 'private' | 'public'
  chunkSize?: number
  chunkOverlap?: number
  embeddingModel?: string
}

export interface UpdateCollectionInput {
  name?: string
  visibility?: 'private' | 'public'
  chunkSize?: number
  chunkOverlap?: number
  embeddingModel?: string
  description?: string | null
  enableSummarization?: boolean
  enableCaptioning?: boolean
  llmModel?: string | null
  instructions?: string | null
}

// ── Documents ─────────────────────────────────────────────────────────────────

export type DocumentStatus =
  | 'pending'
  | 'uploading'
  | 'processing'
  | 'sectioned'
  | 'embedded'
  | 'ready'
  | 'error'

export interface Document {
  id: string
  collectionId: string
  filename: string
  storageKey: string
  markdownStorageKey: string | null
  status: DocumentStatus
  fileSizeBytes: number | null
  markdownFileSizeBytes: number | null
  sectionCount: number | null
  chunkCount: number | null
  contentHash: string | null
  errorMessage: string | null
  createdAt: string
}

export interface UploadUrlRequest {
  filename: string
  contentType: string
  fileSizeBytes: number
  contentHash: string
}

export interface UploadUrlResponse {
  documentId: string
  uploadUrl: string | null
  document?: Document
}

export interface ConfirmUploadResponse {
  document: Document
}

// ── Sections ──────────────────────────────────────────────────────────────────

export interface Section {
  id: string
  documentId: string
  title: string
  level: number
  summary: string | null
  summaryType: 'extractive' | 'generated' | null
  position: number
  chunkCount: number
  markdownOffsetStart: number
  markdownOffsetEnd: number
  content?: string | null
}

// ── Chunks ────────────────────────────────────────────────────────────────────

export interface Chunk {
  id: string
  sectionId: string
  documentId: string
  collectionId: string
  content: string
  position: number
  tokenCount: number
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

export interface RetrievalResult {
  score: number
  chunk: {
    id: string
    content: string
    position: number
    tokenCount: number
  }
  section: {
    id: string
    title: string
    level: number
  }
  document: {
    id: string
    filename: string
  }
}

export interface SectionScanResult {
  score: number
  section: {
    id: string
    title: string
    level: number
    summary: string | null
    summaryType: string | null
    position: number
    chunkCount: number
    markdownOffset: {
      start: number
      end: number
    }
  }
  document: {
    id: string
    filename: string
  }
}

// ── Research ──────────────────────────────────────────────────────────────────

export interface ResearchSource {
  chunkId: string
  content: string
  sectionId: string
  sectionTitle: string
  sectionLevel: number
  documentId: string
  filename: string
}

export type ResearchDepth = 'quick' | 'balanced' | 'deep' | 'exhaustive'

export type ResearchEvent =
  | { type: 'tool_call'; query: string; tool?: string }
  | { type: 'chunk'; content: string }
  | { type: 'done'; sessionId: string; sources: ResearchSource[] }
  | { type: 'error'; message: string }

// ── Provider Keys ─────────────────────────────────────────────────────────────

export type ProviderName = 'openai' | 'cohere' | 'voyageai'

export interface ProviderKey {
  id: string
  projectId: string
  provider: ProviderName
  name: string
  keyPreview: string
  createdAt: string
}

export interface CreateProviderKeyInput {
  provider: ProviderName
  key: string
  name: string
}
