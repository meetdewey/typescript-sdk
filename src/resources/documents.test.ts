import { afterEach, describe, expect, it, vi } from 'vitest'
import { BaseClient } from '../client.js'
import type { Document } from '../types.js'
import { DocumentsResource, type UploadManyItem } from './documents.js'

function makeResource() {
  const client = new BaseClient({
    apiKey: 'test-key',
    baseUrl: 'https://api.example.com',
  })
  return new DocumentsResource(client)
}

const testDoc: Document = {
  id: 'doc-1',
  collectionId: 'col-1',
  filename: 'test.pdf',
  storageKey: 'key-1',
  markdownStorageKey: null,
  status: 'processing',
  fileSizeBytes: 1024,
  markdownFileSizeBytes: null,
  sectionCount: null,
  chunkCount: null,
  contentHash: null,
  errorMessage: null,
  createdAt: '2024-01-01T00:00:00Z',
}

afterEach(() => vi.restoreAllMocks())

// ── uploadMany ────────────────────────────────────────────────────────────────

describe('DocumentsResource.uploadMany', () => {
  function mockSequential(responses: Response[]) {
    const spy = vi.spyOn(globalThis, 'fetch')
    let call = 0
    spy.mockImplementation(() =>
      Promise.resolve(responses[call++] ?? responses[responses.length - 1]),
    )
    return spy
  }

  function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('calls requestUploadUrl, PUT to S3, then confirm for each file', async () => {
    const resource = makeResource()
    const fileData = Buffer.from('hello pdf')

    mockSequential([
      // requestUploadUrl
      jsonResponse({
        documentId: 'doc-1',
        uploadUrl: 'https://s3.example.com/upload',
      }),
      // S3 PUT
      new Response(null, { status: 200 }),
      // confirm
      jsonResponse(testDoc),
    ])

    const items: UploadManyItem[] = [
      { file: fileData, filename: 'test.pdf', contentType: 'application/pdf' },
    ]
    const docs = await resource.uploadMany('col-1', items)

    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({ id: 'doc-1' })
  })

  it('skips S3 upload and confirm when uploadUrl is null (dedup hit)', async () => {
    const resource = makeResource()
    const fileData = Buffer.from('duplicate content')

    const spy = mockSequential([
      // requestUploadUrl returns null URL (dedup)
      jsonResponse({ documentId: 'doc-1', uploadUrl: null, document: testDoc }),
    ])

    const docs = await resource.uploadMany('col-1', [
      { file: fileData, filename: 'dup.pdf' },
    ])

    expect(docs[0]).toMatchObject({ id: 'doc-1' })
    // Only one fetch call — no S3 PUT or confirm
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('uploads multiple files with concurrency', async () => {
    const resource = makeResource()
    const fileA = Buffer.from('file a')
    const fileB = Buffer.from('file b')

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = typeof url === 'string' ? url : (url as Request).url
      if (u.includes('upload-url'))
        return jsonResponse({
          documentId: 'doc-x',
          uploadUrl: 'https://s3.example.com/x',
        })
      if (u.includes('s3.example.com'))
        return new Response(null, { status: 200 })
      if (u.includes('/confirm')) return jsonResponse(testDoc)
      return new Response('not found', { status: 404 })
    })

    const docs = await resource.uploadMany(
      'col-1',
      [
        { file: fileA, filename: 'a.pdf' },
        { file: fileB, filename: 'b.pdf' },
      ],
      { concurrency: 2 },
    )

    expect(docs).toHaveLength(2)
  })

  it('calls onProgress after each file completes', async () => {
    const resource = makeResource()

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = typeof url === 'string' ? url : (url as Request).url
      if (u.includes('upload-url'))
        return jsonResponse({
          documentId: 'doc-1',
          uploadUrl: 'https://s3.example.com/x',
        })
      if (u.includes('s3.example.com'))
        return new Response(null, { status: 200 })
      if (u.includes('/confirm')) return jsonResponse(testDoc)
      return new Response('not found', { status: 404 })
    })

    const progress: Array<[string, number, number]> = []
    await resource.uploadMany(
      'col-1',
      [{ file: Buffer.from('x'), filename: 'x.pdf' }],
      {
        onProgress: (doc, completed, total) => {
          progress.push([doc.id, completed, total])
        },
      },
    )

    expect(progress).toEqual([['doc-1', 1, 1]])
  })

  it('preserves result order regardless of completion order', async () => {
    const resource = makeResource()
    const docA = { ...testDoc, id: 'doc-a', filename: 'a.pdf' }
    const docB = { ...testDoc, id: 'doc-b', filename: 'b.pdf' }

    let callCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = typeof url === 'string' ? url : (url as Request).url
      if (u.includes('upload-url')) {
        callCount++
        return jsonResponse({
          documentId: `doc-${callCount === 1 ? 'a' : 'b'}`,
          uploadUrl: null,
          document: callCount === 1 ? docA : docB,
        })
      }
      return new Response('not found', { status: 404 })
    })

    const docs = await resource.uploadMany('col-1', [
      { file: Buffer.from('a'), filename: 'a.pdf' },
      { file: Buffer.from('b'), filename: 'b.pdf' },
    ])

    expect(docs[0].id).toBe('doc-a')
    expect(docs[1].id).toBe('doc-b')
  })

  it('throws when S3 PUT fails', async () => {
    const resource = makeResource()

    mockSequential([
      jsonResponse({
        documentId: 'doc-1',
        uploadUrl: 'https://s3.example.com/x',
      }),
      new Response('Access Denied', { status: 403 }),
    ])

    await expect(
      resource.uploadMany('col-1', [
        { file: Buffer.from('x'), filename: 'x.pdf' },
      ]),
    ).rejects.toThrow('S3 upload failed')
  })
})
