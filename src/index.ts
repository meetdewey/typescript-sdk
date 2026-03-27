import { BaseClient, DeweyError } from './client.js'
import type { DeweyClientOptions } from './client.js'
import { CollectionsResource } from './resources/collections.js'
import { DocumentsResource } from './resources/documents.js'
import { ProviderKeysResource } from './resources/provider-keys.js'
import { ResearchResource } from './resources/research.js'
import { RetrievalResource } from './resources/retrieval.js'
import { SectionsResource } from './resources/sections.js'

export { DeweyError } from './client.js'
export type { DeweyClientOptions } from './client.js'
export * from './types.js'

export class DeweyClient {
  /** Access and manage collections. */
  readonly collections: CollectionsResource
  /** Upload and manage documents. */
  readonly documents: DocumentsResource
  /** Browse sections and chunks. */
  readonly sections: SectionsResource
  /** Hybrid semantic + keyword retrieval. */
  readonly retrieval: RetrievalResource
  /** Agentic research via SSE streaming. */
  readonly research: ResearchResource
  /** Manage provider API keys for a project. */
  readonly providerKeys: ProviderKeysResource

  private readonly _base: BaseClient

  constructor(options: DeweyClientOptions) {
    this._base = new BaseClient(options)
    this.collections = new CollectionsResource(this._base)
    this.documents = new DocumentsResource(this._base)
    this.sections = new SectionsResource(this._base)
    this.retrieval = new RetrievalResource(this._base)
    this.research = new ResearchResource(this._base)
    this.providerKeys = new ProviderKeysResource(this._base)
  }
}
