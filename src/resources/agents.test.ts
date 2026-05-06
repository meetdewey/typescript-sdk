import { afterEach, describe, expect, it, vi } from 'vitest'
import { BaseClient } from '../client.js'
import type { AgentInvokeResult, AgentRunEvent } from '../types.js'
import { AgentsResource } from './agents.js'

const ORG = 'org-uuid-1'
const PROJECT = 'proj-uuid-2'
const AGENT = 'qa-test'

function makeResource() {
  const client = new BaseClient({
    apiKey: 'test-key',
    baseUrl: 'https://api.example.com',
  })
  return { resource: new AgentsResource(client), client }
}

function mockFetchJson(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

/** Build an SSE-style ReadableStream from a list of event payloads. */
function sseStream(events: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const e of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
      }
      controller.close()
    },
  })
}

afterEach(() => vi.restoreAllMocks())

describe('AgentsResource.invokeSync', () => {
  it('POSTs to /orgs/:orgId/projects/:projectId/agents/:slug/invoke/sync', async () => {
    const result: AgentInvokeResult = {
      runId: 'run-1',
      response: 'answer',
      sources: [],
      status: 'succeeded',
    }
    const spy = mockFetchJson(result)
    const { resource } = makeResource()

    await resource.invokeSync(ORG, PROJECT, AGENT, { query: 'why?' })

    expect(spy.mock.calls[0]?.[0]).toBe(
      `https://api.example.com/orgs/${ORG}/projects/${PROJECT}/agents/${AGENT}/invoke/sync`,
    )
    expect(spy.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(JSON.parse(spy.mock.calls[0]?.[1]?.body as string)).toEqual({
      query: 'why?',
    })
  })

  it('returns the parsed sync result', async () => {
    const result: AgentInvokeResult = {
      runId: 'run-1',
      response: 'Polio cases dropped [1].',
      sources: [
        {
          chunkId: 'c1',
          sectionId: 's1',
          sectionTitle: 'Methods',
          sectionLevel: 2,
          documentId: 'd1',
          filename: 'paper.pdf',
          score: 0.83,
          collectionId: 'col-1',
          collectionName: 'Polio',
        },
      ],
      status: 'succeeded',
    }
    mockFetchJson(result)
    const { resource } = makeResource()

    const got = await resource.invokeSync(ORG, PROJECT, AGENT, { query: 'q' })
    expect(got).toEqual(result)
  })

  it('throws DeweyError on non-2xx', async () => {
    mockFetchJson({ message: 'Concurrency cap reached.' }, 429)
    const { resource } = makeResource()
    await expect(
      resource.invokeSync(ORG, PROJECT, AGENT, { query: 'q' }),
    ).rejects.toThrow('Concurrency cap reached.')
  })
})

describe('AgentsResource.stream', () => {
  it('POSTs to /invoke and yields parsed SSE events', async () => {
    const events: AgentRunEvent[] = [
      { type: 'run_started', runId: 'run-1' },
      { type: 'chunk', content: 'Polio ' },
      { type: 'chunk', content: 'cases.' },
      {
        type: 'done',
        runId: 'run-1',
        status: 'succeeded',
        response: 'Polio cases.',
        iterationsUsed: 2,
        sources: [],
      },
    ]
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(sseStream(events), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )

    const { resource } = makeResource()
    const got: AgentRunEvent[] = []
    for await (const e of resource.stream(ORG, PROJECT, AGENT, {
      query: 'why?',
    })) {
      got.push(e)
    }

    expect(spy.mock.calls[0]?.[0]).toBe(
      `https://api.example.com/orgs/${ORG}/projects/${PROJECT}/agents/${AGENT}/invoke`,
    )
    expect(spy.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(
      (spy.mock.calls[0]?.[1]?.headers as Record<string, string>).Accept,
    ).toBe('text/event-stream')
    expect(got).toEqual(events)
  })
})
