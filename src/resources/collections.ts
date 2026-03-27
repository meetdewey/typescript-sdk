import type { BaseClient } from '../client.js'
import type {
  Collection,
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
}
