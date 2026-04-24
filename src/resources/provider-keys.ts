import type { BaseClient } from '../client.js'
import type { CreateProviderKeyInput, ProviderKey } from '../types.js'

export class ProviderKeysResource {
  constructor(private readonly client: BaseClient) {}

  /**
   * Add a provider API key (org-scoped via API key auth).
   *
   * @param input.provider - The provider (e.g. `'openai'`).
   * @param input.key - The raw API key value.
   * @param input.name - A human-readable label.
   */
  create(input: CreateProviderKeyInput): Promise<ProviderKey> {
    return this.client.request<ProviderKey>('POST', '/provider-keys', {
      body: input,
    })
  }

  /** List all provider keys for the authenticated org. */
  list(): Promise<ProviderKey[]> {
    return this.client.request<ProviderKey[]>('GET', '/provider-keys')
  }

  /** Delete a provider key by ID. Returns void on success. */
  delete(keyId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/provider-keys/${keyId}`)
  }
}
