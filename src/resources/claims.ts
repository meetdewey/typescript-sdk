import type { BaseClient } from '../client.js'
import type { ClaimMapEvent, DocumentClaims } from '../types.js'

export class ClaimsResource {
  constructor(private readonly client: BaseClient) {}

  /**
   * Stream the claim map for a collection via SSE.
   *
   * Yields `ClaimMapEvent` objects as they arrive:
   * - `{ type: 'progress', pct }` — processing progress (0–100)
   * - `{ type: 'done', total, claims }` — all claims with UMAP coordinates
   * - `{ type: 'error', message }` — an error occurred
   *
   * @example
   * ```ts
   * for await (const event of client.claims.mapStream('col_id')) {
   *   if (event.type === 'done') console.log(event.claims)
   * }
   * ```
   */
  async *mapStream(collectionId: string): AsyncIterable<ClaimMapEvent> {
    for await (const event of this.client.streamSSEGet(
      `/collections/${collectionId}/claims/map`,
    )) {
      yield event as unknown as ClaimMapEvent
    }
  }

  /**
   * List claims extracted from a specific document.
   *
   * @param documentId - The document ID.
   * @param options.minImportance - Minimum importance score (1–5). Defaults to 1.
   */
  listByDocument(
    documentId: string,
    options: { minImportance?: number } = {},
  ): Promise<DocumentClaims> {
    const params = new URLSearchParams()
    if (options.minImportance != null) {
      params.set('minImportance', String(options.minImportance))
    }
    const qs = params.toString()
    return this.client.request<DocumentClaims>(
      'GET',
      `/documents/${documentId}/claims${qs ? `?${qs}` : ''}`,
    )
  }
}
