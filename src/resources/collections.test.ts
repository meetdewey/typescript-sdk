import { afterEach, describe, expect, it, vi } from 'vitest'
import { BaseClient } from '../client.js'
import { CollectionsResource } from './collections.js'

function makeResource() {
  const client = new BaseClient({
    apiKey: 'test-key',
    baseUrl: 'https://api.example.com',
  })
  return { resource: new CollectionsResource(client), client }
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

describe('CollectionsResource', () => {
  it('list() calls GET /collections', async () => {
    const spy = mockFetch([])
    const { resource } = makeResource()
    await resource.list()
    expect(spy.mock.calls[0]?.[0]).toBe('https://api.example.com/collections')
    expect(spy.mock.calls[0]?.[1]?.method).toBe('GET')
  })

  it('get() calls GET /collections/:id', async () => {
    const spy = mockFetch({ id: 'col-1' })
    const { resource } = makeResource()
    await resource.get('col-1')
    expect(spy.mock.calls[0]?.[0]).toBe(
      'https://api.example.com/collections/col-1',
    )
    expect(spy.mock.calls[0]?.[1]?.method).toBe('GET')
  })

  it('create() calls POST /collections with body', async () => {
    const spy = mockFetch({ id: 'col-1', name: 'My Docs' }, 201)
    const { resource } = makeResource()
    await resource.create({ name: 'My Docs', projectId: 'proj-1' })
    expect(spy.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(JSON.parse(spy.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      name: 'My Docs',
      projectId: 'proj-1',
    })
  })

  it('update() calls PATCH /collections/:id with body', async () => {
    const spy = mockFetch({ id: 'col-1', name: 'Updated' })
    const { resource } = makeResource()
    await resource.update('col-1', { name: 'Updated' })
    expect(spy.mock.calls[0]?.[0]).toBe(
      'https://api.example.com/collections/col-1',
    )
    expect(spy.mock.calls[0]?.[1]?.method).toBe('PATCH')
  })

  it('delete() calls DELETE /collections/:id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )
    const { resource } = makeResource()
    const result = await resource.delete('col-1')
    expect(result).toBeUndefined()
  })
})
