import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseClient, DeweyError } from './client.js'

function makeClient() {
  return new BaseClient({
    apiKey: 'test-key',
    baseUrl: 'https://api.example.com',
  })
}

function mockFetch(
  body: unknown,
  status = 200,
  contentType = 'application/json',
) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': contentType },
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ── request ───────────────────────────────────────────────────────────────────

describe('BaseClient.request', () => {
  it('builds correct URL', async () => {
    const spy = mockFetch({ ok: true })
    const client = makeClient()
    await client.request('GET', '/collections')
    expect(spy.mock.calls[0]?.[0]).toBe('https://api.example.com/collections')
  })

  it('sets Authorization header', async () => {
    const spy = mockFetch({})
    const client = makeClient()
    await client.request('GET', '/collections')
    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer test-key')
  })

  it('returns parsed JSON on 200', async () => {
    mockFetch([{ id: 'col-1', name: 'Docs' }])
    const client = makeClient()
    const result = await client.request<{ id: string; name: string }[]>(
      'GET',
      '/collections',
    )
    expect(result).toEqual([{ id: 'col-1', name: 'Docs' }])
  })

  it('returns undefined on 204', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )
    const client = makeClient()
    const result = await client.request('DELETE', '/collections/col-1')
    expect(result).toBeUndefined()
  })

  it('returns plain text for text/plain responses', async () => {
    mockFetch('hello world', 200, 'text/plain')
    const client = makeClient()
    const result = await client.request<string>('GET', '/something')
    expect(result).toBe('hello world')
  })

  it('sends JSON body with Content-Type header', async () => {
    const spy = mockFetch({ id: 'col-1' }, 201)
    const client = makeClient()
    await client.request('POST', '/collections', { body: { name: 'Test' } })
    const init = spy.mock.calls[0]?.[1]
    const headers = init?.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'Test' })
  })

  it('throws DeweyError on 4xx with status and message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Collection not found' }), {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = makeClient()
    await expect(
      client.request('GET', '/collections/bad-id'),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Collection not found',
    })
  })

  it('throws DeweyError using statusText when body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' }),
    )
    const client = makeClient()
    await expect(client.request('GET', '/collections')).rejects.toBeInstanceOf(
      DeweyError,
    )
  })

  it('strips trailing slash from baseUrl', () => {
    const client = new BaseClient({
      apiKey: 'k',
      baseUrl: 'https://api.example.com/',
    })
    expect(client.baseUrl).toBe('https://api.example.com')
  })
})

// ── streamSSE ─────────────────────────────────────────────────────────────────

describe('BaseClient.streamSSE', () => {
  function makeSseResponse(lines: string[]) {
    const body = `${lines.join('\n')}\n`
    return new Response(new TextEncoder().encode(body), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  it('yields parsed JSON events', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeSseResponse([
        'data: {"type":"chunk","content":"Hello"}',
        '',
        'data: {"type":"chunk","content":" world"}',
        '',
      ]),
    )
    const client = makeClient()
    const events: unknown[] = []
    for await (const event of client.streamSSE('/research', { q: 'test' })) {
      events.push(event)
    }
    expect(events).toEqual([
      { type: 'chunk', content: 'Hello' },
      { type: 'chunk', content: ' world' },
    ])
  })

  it('stops yielding on [DONE]', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeSseResponse([
        'data: {"type":"chunk","content":"Hi"}',
        '',
        'data: [DONE]',
        '',
        'data: {"type":"chunk","content":"ignored"}',
        '',
      ]),
    )
    const client = makeClient()
    const events: unknown[] = []
    for await (const event of client.streamSSE('/research', { q: 'test' })) {
      events.push(event)
    }
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'chunk', content: 'Hi' })
  })

  it('skips malformed data lines', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeSseResponse(['data: not-json', '', 'data: {"type":"done"}', '']),
    )
    const client = makeClient()
    const events: unknown[] = []
    for await (const event of client.streamSSE('/research', { q: 'test' })) {
      events.push(event)
    }
    expect(events).toEqual([{ type: 'done' }])
  })

  it('throws DeweyError on non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = makeClient()
    const gen = client.streamSSE('/research', { q: 'test' })
    await expect(gen.next()).rejects.toMatchObject({ status: 401 })
  })
})
