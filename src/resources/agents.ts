import type { BaseClient } from '../client.js'
import type { AgentInvokeResult, AgentRunEvent } from '../types.js'

/**
 * Invoke saved agents defined in the dashboard. Streaming runs return the
 * progress events the dashboard's Try-it tab consumes; sync returns just the
 * final answer + sources.
 *
 * Identifiers: `orgId` and `projectId` are UUIDs (not slugs). `agentSlug` is
 * the human-readable slug shown in dashboard URLs (e.g. `qa-test`).
 */
export class AgentsResource {
  constructor(private readonly client: BaseClient) {}

  /**
   * Stream an agent run via Server-Sent Events. Yields `AgentRunEvent`s as
   * the executor produces them — `chunk` for streaming text, `tool_call` /
   * `tool_result` for retrieval activity, `done` for the final response.
   *
   * @example
   * ```ts
   * for await (const e of client.agents.stream(orgId, projectId, 'qa-test', {
   *   query: 'What changed in 2023?',
   * })) {
   *   if (e.type === 'chunk') process.stdout.write(e.content)
   *   if (e.type === 'done') console.log('\nSources:', e.sources)
   * }
   * ```
   */
  async *stream(
    orgId: string,
    projectId: string,
    agentSlug: string,
    options: { query: string },
  ): AsyncIterable<AgentRunEvent> {
    for await (const event of this.client.streamSSE(
      `/orgs/${orgId}/projects/${projectId}/agents/${agentSlug}/invoke`,
      { query: options.query },
    )) {
      yield event as unknown as AgentRunEvent
    }
  }

  /**
   * Run an agent and wait for the buffered response. Same auth and pre-flight
   * gates as `stream()`; just returns once the executor terminates instead of
   * streaming events. Useful for non-streaming environments (Lambda, scripts).
   *
   * @example
   * ```ts
   * const result = await client.agents.invokeSync(orgId, projectId, 'qa-test', {
   *   query: 'What changed in 2023?',
   * })
   * console.log(result.response)
   * console.log(result.sources.length, 'sources')
   * ```
   */
  async invokeSync(
    orgId: string,
    projectId: string,
    agentSlug: string,
    options: { query: string },
  ): Promise<AgentInvokeResult> {
    return this.client.request<AgentInvokeResult>(
      'POST',
      `/orgs/${orgId}/projects/${projectId}/agents/${agentSlug}/invoke/sync`,
      { body: { query: options.query } },
    )
  }
}
