import type { BaseClient } from '../client.js'
import type {
  Contradiction,
  ContradictionDetectResult,
  ContradictionList,
  ContradictionRun,
} from '../types.js'

export class ContradictionsResource {
  constructor(private readonly client: BaseClient) {}

  /**
   * List contradictions detected in a collection.
   *
   * @param collectionId - The collection ID.
   * @param options.severity - Filter by severity level.
   * @param options.status - Filter by resolution status. Defaults to `'active'`.
   * @param options.limit - Maximum results to return (1–100).
   */
  list(
    collectionId: string,
    options: {
      severity?: 'low' | 'medium' | 'high'
      status?: 'active' | 'dismissed' | 'applied'
      limit?: number
    } = {},
  ): Promise<ContradictionList> {
    const params = new URLSearchParams()
    if (options.severity) params.set('severity', options.severity)
    if (options.status) params.set('status', options.status)
    if (options.limit != null) params.set('limit', String(options.limit))
    const qs = params.toString()
    return this.client.request<ContradictionList>(
      'GET',
      `/collections/${collectionId}/contradictions${qs ? `?${qs}` : ''}`,
    )
  }

  /**
   * Trigger an asynchronous contradiction detection run across all claims in a collection.
   * Poll progress with `getLatestRun`.
   */
  detect(collectionId: string): Promise<ContradictionDetectResult> {
    return this.client.request<ContradictionDetectResult>(
      'POST',
      `/collections/${collectionId}/contradictions/detect`,
    )
  }

  /**
   * Get the status and stats of the latest contradiction detection run.
   */
  getLatestRun(collectionId: string): Promise<ContradictionRun> {
    return this.client.request<ContradictionRun>(
      'GET',
      `/collections/${collectionId}/contradictions/runs/latest`,
    )
  }

  /**
   * Dismiss a contradiction (mark as ignored).
   */
  dismiss(
    collectionId: string,
    contradictionId: string,
  ): Promise<Contradiction> {
    return this.client.request<Contradiction>(
      'PATCH',
      `/collections/${collectionId}/contradictions/${contradictionId}`,
      { body: { status: 'dismissed' } },
    )
  }

  /**
   * Apply a resolution instruction to a contradiction. The instruction is
   * appended to the collection's research instructions automatically.
   *
   * @param instruction - Custom instruction to apply. If omitted, the
   *   suggested instruction from the contradiction is used.
   */
  applyInstruction(
    collectionId: string,
    contradictionId: string,
    instruction?: string,
  ): Promise<void> {
    return this.client.request<void>(
      'POST',
      `/collections/${collectionId}/contradictions/${contradictionId}/apply-instruction`,
      { body: instruction ? { instruction } : {} },
    )
  }
}
