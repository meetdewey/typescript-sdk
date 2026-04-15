import type { BaseClient } from '../client.js'
import type { ResearchDepth, ResearchEvent, ResearchResult } from '../types.js'

export class ResearchResource {
  constructor(private readonly client: BaseClient) {}

  /**
   * Stream a research session using SSE.
   *
   * Yields `ResearchEvent` objects as they arrive:
   * - `{ type: 'tool_call', query, tool? }` — a tool was invoked
   * - `{ type: 'chunk', content }` — a streamed response token
   * - `{ type: 'done', sessionId, sources }` — session complete
   * - `{ type: 'error', message }` — an error occurred
   *
   * @example
   * ```ts
   * for await (const event of client.research.stream('col_id', 'What is X?')) {
   *   if (event.type === 'chunk') process.stdout.write(event.content)
   *   if (event.type === 'done') console.log('Sources:', event.sources)
   * }
   * ```
   */
  async *stream(
    collectionId: string,
    q: string,
    options: { depth?: ResearchDepth; model?: string } = {},
  ): AsyncIterable<ResearchEvent> {
    const body: Record<string, unknown> = { q }
    if (options.depth) body.depth = options.depth
    if (options.model) body.model = options.model

    for await (const event of this.client.streamSSE(
      `/collections/${collectionId}/research`,
      body,
    )) {
      yield event as unknown as ResearchEvent
    }
  }

  /**
   * Run a research query and return the complete answer as a single response.
   * Useful in environments that cannot consume Server-Sent Events.
   *
   * @example
   * ```ts
   * const result = await client.research.researchSync('col_id', 'What is X?')
   * console.log(result.answer)
   * console.log(result.sources)
   * ```
   */
  async researchSync(
    collectionId: string,
    q: string,
    options: { depth?: ResearchDepth; model?: string } = {},
  ): Promise<ResearchResult> {
    const body: Record<string, unknown> = { q }
    if (options.depth) body.depth = options.depth
    if (options.model) body.model = options.model

    return this.client.request<ResearchResult>(
      'POST',
      `/collections/${collectionId}/research/sync`,
      { body },
    )
  }
}
