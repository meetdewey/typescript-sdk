import type { BaseClient } from '../client.js'
import type {
  DuplicateDetectResult,
  DuplicateGroupList,
  DuplicateRun,
} from '../types.js'

/**
 * Fuzzy document deduplication. Identifies near-duplicate documents within a
 * collection by measuring how much content they share and marks one member of
 * each cluster as canonical. Non-canonical documents are excluded from
 * retrieval and contradiction detection.
 *
 * Must be enabled per-collection via `collections.update(id, { enableDeduplication: true })`.
 */
export class DuplicatesResource {
  constructor(private readonly client: BaseClient) {}

  /**
   * Trigger an asynchronous deduplication run across every ready document in
   * the collection. Poll progress with {@link getLatestRun}.
   *
   * Requires `enableDeduplication` to be set on the collection. Returns 409 if
   * a dedup run is already in flight.
   */
  detect(collectionId: string): Promise<DuplicateDetectResult> {
    return this.client.request<DuplicateDetectResult>(
      'POST',
      `/collections/${collectionId}/duplicates/detect`,
    )
  }

  /** Get the status and stats of the latest deduplication run. */
  getLatestRun(collectionId: string): Promise<DuplicateRun> {
    return this.client.request<DuplicateRun>(
      'GET',
      `/collections/${collectionId}/duplicates/runs/latest`,
    )
  }

  /**
   * List duplicate groups in the collection with their members.
   *
   * @param options.limit - Maximum results to return (1–100). Default 50.
   * @param options.offset - Pagination offset. Default 0.
   */
  list(
    collectionId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<DuplicateGroupList> {
    const params = new URLSearchParams()
    if (options.limit != null) params.set('limit', String(options.limit))
    if (options.offset != null) params.set('offset', String(options.offset))
    const qs = params.toString()
    return this.client.request<DuplicateGroupList>(
      'GET',
      `/collections/${collectionId}/duplicates${qs ? `?${qs}` : ''}`,
    )
  }

  /**
   * Promote a different member of the group to canonical. The previous
   * canonical becomes a near_duplicate. Coverage percentages are cleared
   * since they describe the old pairing.
   */
  promoteCanonical(
    collectionId: string,
    groupId: string,
    canonicalDocumentId: string,
  ): Promise<{ success: boolean; changed: boolean }> {
    return this.client.request<{ success: boolean; changed: boolean }>(
      'PATCH',
      `/collections/${collectionId}/duplicates/${groupId}`,
      { body: { canonicalDocumentId } },
    )
  }

  /**
   * Disband a duplicate group. All former members rejoin retrieval as
   * distinct documents with no group membership or canonical relationship.
   */
  disband(
    collectionId: string,
    groupId: string,
  ): Promise<{ success: boolean }> {
    return this.client.request<{ success: boolean }>(
      'DELETE',
      `/collections/${collectionId}/duplicates/${groupId}`,
    )
  }
}
