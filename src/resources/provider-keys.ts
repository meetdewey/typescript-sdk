import type { BaseClient } from '../client.js'
import type { CreateProviderKeyInput, ProviderKey } from '../types.js'

export class ProviderKeysResource {
  constructor(private readonly client: BaseClient) {}

  /**
   * Add a provider API key to a project.
   *
   * @param projectId - The project to add the key to.
   * @param input.provider - The provider (e.g. `'openai'`).
   * @param input.key - The raw API key value.
   * @param input.name - A human-readable label.
   */
  create(
    projectId: string,
    input: CreateProviderKeyInput,
  ): Promise<ProviderKey> {
    return this.client.request<ProviderKey>(
      'POST',
      `/projects/${projectId}/provider-keys`,
      { body: input },
    )
  }

  /** List all provider keys for a project. */
  list(projectId: string): Promise<ProviderKey[]> {
    return this.client.request<ProviderKey[]>(
      'GET',
      `/projects/${projectId}/provider-keys`,
    )
  }

  /** Delete a provider key. Returns void on success. */
  delete(projectId: string, keyId: string): Promise<void> {
    return this.client.request<void>(
      'DELETE',
      `/projects/${projectId}/provider-keys/${keyId}`,
    )
  }
}
