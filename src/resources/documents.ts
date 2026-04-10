import { createHash } from 'node:crypto'
import type { BaseClient } from '../client.js'
import type { Document, UploadUrlRequest, UploadUrlResponse } from '../types.js'

export type UploadFileInput = File | Blob | Buffer | NodeJS.ReadableStream

export interface UploadOptions {
  /** Original filename (required when passing Buffer or ReadableStream). */
  filename?: string
  /** MIME type (required when passing Buffer or ReadableStream). */
  contentType?: string
  /** SHA-256 hex hash of the file content (optional). */
  contentHash?: string
  /** Human-readable name for the document (defaults to filename). */
  name?: string
}

export interface UploadManyItem {
  file: UploadFileInput
  /** Original filename (required when passing Buffer or ReadableStream). */
  filename?: string
  /** MIME type. Defaults to application/octet-stream. */
  contentType?: string
}

export interface UploadManyOptions {
  /**
   * Maximum number of files to upload in parallel.
   * Higher values finish faster but increase API and S3 load.
   * @default 5
   */
  concurrency?: number
  /**
   * Called each time a file finishes uploading.
   * @param document - The resulting Document object.
   * @param completed - Number of files completed so far (1-based).
   * @param total - Total number of files in the batch.
   */
  onProgress?: (document: Document, completed: number, total: number) => void
}

export class DocumentsResource {
  constructor(private readonly client: BaseClient) {}

  /**
   * Upload a document via multipart/form-data.
   * Accepts File, Blob, Buffer, or a Node.js ReadableStream.
   */
  async upload(
    collectionId: string,
    file: UploadFileInput,
    options: UploadOptions = {},
  ): Promise<Document> {
    const fd = new FormData()

    if (file instanceof File) {
      fd.append('file', file, options.filename ?? file.name)
    } else if (file instanceof Blob) {
      const name = options.filename ?? 'upload'
      fd.append('file', file, name)
    } else if (Buffer.isBuffer(file)) {
      const name = options.filename ?? 'upload'
      const type = options.contentType ?? 'application/octet-stream'
      const blob = new Blob([file.buffer as ArrayBuffer], { type })
      fd.append('file', blob, name)
    } else {
      // ReadableStream — collect into buffer first
      const chunks: Buffer[] = []
      for await (const chunk of file as AsyncIterable<Buffer>) {
        chunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array),
        )
      }
      const buf = Buffer.concat(chunks)
      const name = options.filename ?? 'upload'
      const type = options.contentType ?? 'application/octet-stream'
      const blob = new Blob([buf], { type })
      fd.append('file', blob, name)
    }

    if (options.name) fd.append('name', options.name)
    if (options.contentHash) fd.append('contentHash', options.contentHash)

    return this.client.request<Document>(
      'POST',
      `/collections/${collectionId}/documents`,
      { formData: fd },
    )
  }

  /**
   * Request a presigned upload URL.
   * After uploading to the URL, call `confirm()` to trigger processing.
   */
  requestUploadUrl(
    collectionId: string,
    input: UploadUrlRequest,
  ): Promise<UploadUrlResponse> {
    return this.client.request<UploadUrlResponse>(
      'POST',
      `/collections/${collectionId}/documents/upload-url`,
      { body: input },
    )
  }

  /**
   * Confirm that a presigned upload has completed and trigger ingestion.
   */
  confirm(collectionId: string, documentId: string): Promise<Document> {
    return this.client.request<Document>(
      'POST',
      `/collections/${collectionId}/documents/${documentId}/confirm`,
    )
  }

  /** List all documents in a collection. */
  list(collectionId: string): Promise<Document[]> {
    return this.client.request<Document[]>(
      'GET',
      `/collections/${collectionId}/documents`,
    )
  }

  /** Get a single document by ID. */
  get(collectionId: string, documentId: string): Promise<Document> {
    return this.client.request<Document>('GET', `/documents/${documentId}`)
  }

  /** Get the rendered Markdown for a document. Returns the raw Markdown string. */
  getMarkdown(collectionId: string, documentId: string): Promise<string> {
    return this.client.request<string>(
      'GET',
      `/documents/${documentId}/markdown`,
    )
  }

  /** Retry a failed document. */
  retry(collectionId: string, documentId: string): Promise<Document> {
    return this.client.request<Document>(
      'POST',
      `/documents/${documentId}/retry`,
    )
  }

  /** Delete a document. Returns void on success. */
  delete(collectionId: string, documentId: string): Promise<void> {
    return this.client.request<void>('DELETE', `/documents/${documentId}`)
  }

  /**
   * Upload multiple files efficiently using presigned S3 URLs.
   *
   * Each file is uploaded directly to S3 (bypassing the API server), so there
   * are no payload-size limits and throughput scales with your network. Files
   * are uploaded `concurrency` at a time (default 5).
   *
   * If a file's SHA-256 hash matches an existing document, the API returns the
   * existing document immediately — no upload or confirm round-trip needed.
   *
   * @example
   * ```ts
   * import { readdirSync } from 'node:fs'
   * import { readFile } from 'node:fs/promises'
   *
   * const files = readdirSync('./docs')
   *   .filter(f => f.endsWith('.pdf'))
   *   .map(f => ({ file: await readFile(`./docs/${f}`), filename: f }))
   *
   * const docs = await client.documents.uploadMany(collectionId, files, {
   *   concurrency: 10,
   *   onProgress: (doc, n, total) => console.log(`${n}/${total} ${doc.filename}`),
   * })
   * ```
   */
  async uploadMany(
    collectionId: string,
    files: UploadManyItem[],
    options: UploadManyOptions = {},
  ): Promise<Document[]> {
    const { concurrency = 5, onProgress } = options
    const total = files.length
    const results: Document[] = new Array(total)
    let completed = 0

    // Resolve a file input to a Buffer
    const toBuffer = async (item: UploadManyItem): Promise<Buffer> => {
      const { file } = item
      if (Buffer.isBuffer(file)) return file
      if (file instanceof Uint8Array) return Buffer.from(file)
      if (file instanceof Blob) return Buffer.from(await file.arrayBuffer())
      // ReadableStream / NodeJS.ReadableStream
      const chunks: Buffer[] = []
      for await (const chunk of file as AsyncIterable<Buffer>) {
        chunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array),
        )
      }
      return Buffer.concat(chunks)
    }

    const uploadOne = async (
      item: UploadManyItem,
      index: number,
    ): Promise<void> => {
      const data = await toBuffer(item)
      const filename = item.filename ?? 'upload'
      const contentType = item.contentType ?? 'application/octet-stream'
      const contentHash = createHash('sha256').update(data).digest('hex')

      const urlResp = await this.requestUploadUrl(collectionId, {
        filename,
        contentType,
        fileSizeBytes: data.byteLength,
        contentHash,
      })

      let doc: Document
      if (!urlResp.uploadUrl) {
        // Dedup hit — file already exists, document is returned directly
        doc = urlResp.document as Document
      } else {
        // Upload directly to S3 — no auth header needed (baked into signed URL)
        const s3Res = await fetch(urlResp.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: data,
        })
        if (!s3Res.ok) {
          throw new Error(
            `S3 upload failed: ${s3Res.status} ${s3Res.statusText}`,
          )
        }
        doc = await this.confirm(collectionId, urlResp.documentId)
      }

      results[index] = doc
      completed++
      onProgress?.(doc, completed, total)
    }

    // Run with bounded concurrency
    const queue = files.map((item, i) => ({ item, i }))
    const workers = Array.from(
      { length: Math.min(concurrency, total) },
      async () => {
        while (queue.length > 0) {
          const next = queue.shift()
          if (next) await uploadOne(next.item, next.i)
        }
      },
    )
    await Promise.all(workers)

    return results
  }
}
