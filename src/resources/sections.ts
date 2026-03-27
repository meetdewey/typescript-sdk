import type { BaseClient } from '../client.js'
import type { Chunk, Section } from '../types.js'

export class SectionsResource {
  constructor(private readonly client: BaseClient) {}

  /** List all sections for a document. */
  list(collectionId: string, documentId: string): Promise<Section[]> {
    return this.client.request<Section[]>(
      'GET',
      `/documents/${documentId}/sections`,
    )
  }

  /** Get a single section by ID (includes content). */
  get(sectionId: string): Promise<Section> {
    return this.client.request<Section>('GET', `/sections/${sectionId}`)
  }

  /** Get all chunks for a section. */
  getChunks(sectionId: string): Promise<Chunk[]> {
    return this.client.request<Chunk[]>('GET', `/sections/${sectionId}/chunks`)
  }

  /**
   * Section scan — full-text search over section titles and summaries.
   * Returns a ranked list of sections.
   */
  scan(
    collectionId: string,
    query: string,
    options: { topK?: number } = {},
  ): Promise<{
    results: Array<{
      score: number
      section: {
        id: string
        title: string
        level: number
        summary: string | null
        summaryType: string | null
        position: number
        chunkCount: number
        markdownOffset: { start: number; end: number }
      }
      document: { id: string; filename: string }
    }>
  }> {
    return this.client.request(
      'POST',
      `/collections/${collectionId}/sections/scan`,
      {
        body: {
          query,
          ...(options.topK !== undefined && { top_k: options.topK }),
        },
      },
    )
  }
}
