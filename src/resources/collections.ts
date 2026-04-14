import type { BaseClient } from '../client.js'
import type {
  Collection,
  CollectionStats,
  CreateCollectionInput,
  UpdateCollectionInput,
} from '../types.js'

export class CollectionsResource {
  constructor(private readonly client: BaseClient) {}

  /** Create a new collection. */
  create(input: CreateCollectionInput): Promise<Collection> {
    return this.client.request<Collection>('POST', '/collections', {
      body: input,
    })
  }

  /** List all collections in the project. */
  list(): Promise<Collection[]> {
    return this.client.request<Collection[]>('GET', '/collections')
  }

  /** Get a single collection by ID. */
  get(id: string): Promise<Collection> {
    return this.client.request<Collection>('GET', `/collections/${id}`)
  }

  /** Update a collection. */
  update(id: string, input: UpdateCollectionInput): Promise<Collection> {
    return this.client.request<Collection>('PATCH', `/collections/${id}`, {
      body: input,
    })
  }

  /** Delete a collection (soft delete). Returns void on success. */
  delete(id: string): Promise<void> {
    return this.client.request<void>('DELETE', `/collections/${id}`)
  }

  /** Get document count, storage, section/chunk/claim counts, and processing status breakdown. */
  stats(id: string): Promise<CollectionStats> {
    return this.client.request<CollectionStats>(
      'GET',
      `/collections/${id}/stats`,
    )
  }

  /** Re-run AI section summarization across all documents. Returns void on success. */
  recomputeSummaries(id: string): Promise<void> {
    return this.client.request<void>(
      'POST',
      `/collections/${id}/recompute/summaries`,
    )
  }

  /** Re-run AI captioning for all images and tables across all documents. Returns void on success. */
  recomputeCaptions(id: string): Promise<void> {
    return this.client.request<void>(
      'POST',
      `/collections/${id}/recompute/captions`,
    )
  }

  /** Re-extract factual claims from all documents. Clears existing claims first. Returns void on success. */
  recomputeClaims(id: string): Promise<void> {
    return this.client.request<void>(
      'POST',
      `/collections/${id}/recompute/claims`,
    )
  }
}
