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
   */
  query(
    collectionId: string,
    q: string,
    options: { limit?: number } = {},
  ): Promise<RetrievalResult[]> {
    return this.client.request<RetrievalResult[]>(
      'POST',
      `/collections/${collectionId}/query`,
      {
        body: {
          q,
          ...(options.limit !== undefined && { limit: options.limit }),
        },
      },
    )
  }
}
