import { afterEach, describe, expect, it, vi } from 'vitest'
import { BaseClient } from '../client.js'
import { ContradictionsResource } from './contradictions.js'

function makeResource() {
  const client = new BaseClient({
    apiKey: 'test-key',
    baseUrl: 'https://api.example.com',
  })
  return { resource: new ContradictionsResource(client), client }
}

function mockFetch(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

afterEach(() => vi.restoreAllMocks())

describe('ContradictionsResource.list', () => {
  it('GETs /collections/:id/contradictions with no query when no options', async () => {
    const spy = mockFetch({ total: 0, items: [] })
    const { resource } = makeResource()
    await resource.list('col-1')
    expect(spy.mock.calls[0]?.[0]).toBe(
      'https://api.example.com/collections/col-1/contradictions',
    )
    expect(spy.mock.calls[0]?.[1]?.method).toBe('GET')
  })

  it('forwards severity, status, and limit as query params', async () => {
    const spy = mockFetch({ total: 0, items: [] })
    const { resource } = makeResource()
    await resource.list('col-1', {
      severity: 'high',
      status: 'dismissed',
      limit: 50,
    })
    const url = new URL(spy.mock.calls[0]?.[0] as string)
    expect(url.pathname).toBe('/collections/col-1/contradictions')
    expect(url.searchParams.get('severity')).toBe('high')
    expect(url.searchParams.get('status')).toBe('dismissed')
    expect(url.searchParams.get('limit')).toBe('50')
  })

  it('forwards documentId as a query param', async () => {
    const spy = mockFetch({ total: 0, items: [] })
    const { resource } = makeResource()
    await resource.list('col-1', { documentId: 'doc-42' })
    const url = new URL(spy.mock.calls[0]?.[0] as string)
    expect(url.searchParams.get('documentId')).toBe('doc-42')
  })
})

describe('ContradictionsResource.listFiles', () => {
  it('GETs /collections/:id/contradictions/files', async () => {
    const spy = mockFetch({ files: [] })
    const { resource } = makeResource()
    await resource.listFiles('col-1')
    expect(spy.mock.calls[0]?.[0]).toBe(
      'https://api.example.com/collections/col-1/contradictions/files',
    )
    expect(spy.mock.calls[0]?.[1]?.method).toBe('GET')
  })

  it('forwards status and severity as query params', async () => {
    const spy = mockFetch({ files: [] })
    const { resource } = makeResource()
    await resource.listFiles('col-1', {
      status: 'applied',
      severity: 'medium',
    })
    const url = new URL(spy.mock.calls[0]?.[0] as string)
    expect(url.pathname).toBe('/collections/col-1/contradictions/files')
    expect(url.searchParams.get('status')).toBe('applied')
    expect(url.searchParams.get('severity')).toBe('medium')
  })

  it('returns the parsed file list', async () => {
    mockFetch({
      files: [
        {
          documentId: 'doc-a',
          filename: 'submission.pdf',
          contradictionCount: 5,
        },
        {
          documentId: 'doc-b',
          filename: 'review.pdf',
          contradictionCount: 2,
        },
      ],
    })
    const { resource } = makeResource()
    const result = await resource.listFiles('col-1')
    expect(result.files).toHaveLength(2)
    expect(result.files[0]).toEqual({
      documentId: 'doc-a',
      filename: 'submission.pdf',
      contradictionCount: 5,
    })
  })
})

describe('ContradictionsResource.detect', () => {
  it('POSTs to /collections/:id/contradictions/detect', async () => {
    const spy = mockFetch({
      runId: 'r1',
      status: 'pending',
      enqueuedAt: '2025-01-01T00:00:00Z',
    })
    const { resource } = makeResource()
    await resource.detect('col-1')
    expect(spy.mock.calls[0]?.[0]).toBe(
      'https://api.example.com/collections/col-1/contradictions/detect',
    )
    expect(spy.mock.calls[0]?.[1]?.method).toBe('POST')
  })
})

describe('ContradictionsResource.dismiss', () => {
  it('PATCHes /collections/:id/contradictions/:cId with status=dismissed', async () => {
    const spy = mockFetch({ id: 'c1', status: 'dismissed' })
    const { resource } = makeResource()
    await resource.dismiss('col-1', 'c1')
    expect(spy.mock.calls[0]?.[0]).toBe(
      'https://api.example.com/collections/col-1/contradictions/c1',
    )
    expect(spy.mock.calls[0]?.[1]?.method).toBe('PATCH')
    expect(JSON.parse(spy.mock.calls[0]?.[1]?.body as string)).toEqual({
      status: 'dismissed',
    })
  })
})

describe('ContradictionsResource.applyInstruction', () => {
  it('POSTs apply-instruction with no body when instruction omitted', async () => {
    const spy = mockFetch({})
    const { resource } = makeResource()
    await resource.applyInstruction('col-1', 'c1')
    expect(spy.mock.calls[0]?.[0]).toBe(
      'https://api.example.com/collections/col-1/contradictions/c1/apply-instruction',
    )
    expect(JSON.parse(spy.mock.calls[0]?.[1]?.body as string)).toEqual({})
  })

  it('POSTs apply-instruction with the override instruction when provided', async () => {
    const spy = mockFetch({})
    const { resource } = makeResource()
    await resource.applyInstruction('col-1', 'c1', 'Use the 2024 report.')
    expect(JSON.parse(spy.mock.calls[0]?.[1]?.body as string)).toEqual({
      instruction: 'Use the 2024 report.',
    })
  })
})
