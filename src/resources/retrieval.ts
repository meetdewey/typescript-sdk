import type { BaseClient } from '../client.js'
import type { RetrievalResult } from '../types.js'

export class RetrievalResource {
  constructor(private readonly client: BaseClient) {}

  /**
   * Query a collection using hybrid semantic + keyword search.
   *
   * @param collectionId - The collection to query.
   * @param q - The natural-language query string.
   * @param options.limit - Maximum number of results (1–50, default 10).
   * @param options.tags - Return only docs that have ALL of these tags.
   * @param options.anyTags - Return only docs that have ANY of these tags.
   * @param options.metadata - Return only docs whose metadata contains
   *   all of these key-value pairs (JSONB containment).
   */
  query(
    collectionId: string,
    q: string,
    options: {
      limit?: number
      tags?: string[]
      anyTags?: string[]
      metadata?: Record<string, unknown>
    } = {},
  ): Promise<RetrievalResult[]> {
    const { limit, tags, anyTags, metadata } = options
    return this.client.request<RetrievalResult[]>(
      'POST',
      `/collections/${collectionId}/query`,
      {
        body: {
          q,
          ...(limit !== undefined && { limit }),
          ...(tags?.length && { tags }),
          ...(anyTags?.length && { anyTags }),
          ...(metadata && Object.keys(metadata).length > 0 && { metadata }),
        },
      },
    )
  }
}
