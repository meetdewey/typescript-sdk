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
  enableDeduplication: boolean
  lastDeduplicationAt: string | null
  duplicateGroupCount: number
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
  enableDeduplication?: boolean
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
  duplicateGroupId: string | null
  duplicateRelationship: 'canonical' | 'near_duplicate' | null
  coverageToCanonical: number | null
  coverageFromCanonical: number | null
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

export interface ResearchResult {
  answer: string
  sessionId: string
  sources: ResearchSource[]
}

// ── Claims ────────────────────────────────────────────────────────────────────

export interface ClaimMapItem {
  id: string
  text: string
  sourceText?: string
  documentId: string
  documentName: string
  sectionId: string
  sectionTitle: string
  importance: number
  x: number
  y: number
}

export type ClaimMapEvent =
  | { type: 'progress'; pct: number }
  | { type: 'done'; total: number; claims: ClaimMapItem[] }
  | { type: 'error'; message: string }

export interface Claim {
  id: string
  sectionTitle: string
  sectionLineage: string
  text: string
  importance: number
  position: number
}

export interface DocumentClaims {
  documentId: string
  claims: Claim[]
}

// ── Collection Stats ──────────────────────────────────────────────────────────

export interface CollectionStats {
  docCount: number
  totalFileSizeBytes: number
  totalSections: number
  totalChunks: number
  statusCounts: Record<string, number>
  summarizedCount: number
  captionedCount: number
  claimsExtractedCount: number
  totalClaimsCount: number
}

// ── Contradictions ────────────────────────────────────────────────────────────

export interface ContradictionClaim {
  id: string
  text: string
  document: { id: string; filename: string }
  sectionTitle: string
}

export interface Contradiction {
  id: string
  severity: 'low' | 'medium' | 'high'
  status: 'active' | 'dismissed' | 'applied'
  explanation: string
  suggestedInstruction: string | null
  clusterTopicSummary: string | null
  createdAt: string
  claims: ContradictionClaim[]
}

export interface ContradictionList {
  total: number
  items: Contradiction[]
}

export interface ContradictionDetectResult {
  runId: string
  status: string
  enqueuedAt: string
}

export interface ContradictionRun {
  id: string
  status: string
  claimsProcessed: number | null
  clustersAnalyzed: number | null
  contradictionsFound: number | null
  model: string | null
  startedAt: string | null
  completedAt: string | null
  error: string | null
  createdAt: string
}

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

// ── Duplicates ────────────────────────────────────────────────────────────────

export interface DuplicateGroupMember {
  id: string
  filename: string
  relationship: 'canonical' | 'near_duplicate' | null
  coverageToCanonical: number | null
  coverageFromCanonical: number | null
  createdAt: string
}

export interface DuplicateGroup {
  id: string
  canonicalDocumentId: string
  detectedAt: string
  members: DuplicateGroupMember[]
}

export interface DuplicateGroupList {
  total: number
  items: DuplicateGroup[]
}

export interface DuplicateDetectResult {
  runId: string
  status: string
  jobsEnqueued: number
  enqueuedAt: string
}

export interface DuplicateRun {
  id: string
  status: string
  jobsEnqueued: number | null
  jobsProcessed: number | null
  duplicatesDetected: number | null
  duplicateGroupsCreated: number | null
  startedAt: string | null
  completedAt: string | null
  error: string | null
  createdAt: string
}
