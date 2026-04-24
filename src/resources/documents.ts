import { createHash } from 'node:crypto'
import type { BaseClient } from '../client.js'
import type {
  BatchConfirmDocument,
  Document,
  TagsResponse,
  UpdateDocumentInput,
  UploadUrlRequest,
  UploadUrlResponse,
} from '../types.js'

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
  /** Tags to assign to the document. */
  tags?: string[]
  /** Structured metadata to attach to the document. */
  metadata?: Record<string, unknown>
}

export interface UploadManyItem {
  file: UploadFileInput
  /** Original filename (required when passing Buffer or ReadableStream). */
  filename?: string
  /** MIME type. Defaults to application/octet-stream. */
  contentType?: string
  /** Tags to assign to the document. */
  tags?: string[]
  /** Structured metadata to attach to the document. */
  metadata?: Record<string, unknown>
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
    if (options.tags) fd.append('tags', JSON.stringify(options.tags))
    if (options.metadata)
      fd.append('metadata', JSON.stringify(options.metadata))

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
   * Optionally set tags and metadata at confirm time.
   */
  confirm(
    collectionId: string,
    documentId: string,
    options: { tags?: string[]; metadata?: Record<string, unknown> } = {},
  ): Promise<Document> {
    const body =
      options.tags !== undefined || options.metadata !== undefined
        ? options
        : undefined
    return this.client.request<Document>(
      'POST',
      `/collections/${collectionId}/documents/${documentId}/confirm`,
      body !== undefined ? { body } : undefined,
    )
  }

  /**
   * Update a document's tags and/or metadata.
   * By default metadata is merged; pass `replaceMetadata: true` to replace it.
   */
  update(
    collectionId: string,
    documentId: string,
    input: UpdateDocumentInput,
  ): Promise<Document> {
    return this.client.request<Document>(
      'PATCH',
      `/collections/${collectionId}/documents/${documentId}`,
      { body: input },
    )
  }

  /** List all tags used across documents in a collection, with counts. */
  listTags(collectionId: string): Promise<TagsResponse> {
    return this.client.request<TagsResponse>(
      'GET',
      `/collections/${collectionId}/tags`,
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
   * Upload multiple files in a single multipart request.
   * Simpler than `uploadMany` when files are small enough for one HTTP call.
   */
  async batchUpload(
    collectionId: string,
    files: UploadManyItem[],
  ): Promise<Document[]> {
    type FileMeta = { tags?: string[]; metadata?: Record<string, unknown> }
    const fileMetadata: Record<string, FileMeta> = {}
    const resolved: Array<{ blob: Blob; filename: string }> = []

    for (const item of files) {
      const filename = item.filename ?? 'upload'
      const contentType = item.contentType ?? 'application/octet-stream'
      let blob: Blob
      if (item.file instanceof File) {
        blob = item.file
      } else if (item.file instanceof Blob) {
        blob = item.file
      } else if (Buffer.isBuffer(item.file)) {
        blob = new Blob([item.file.buffer as ArrayBuffer], {
          type: contentType,
        })
      } else {
        const chunks: Buffer[] = []
        for await (const chunk of item.file as AsyncIterable<Buffer>) {
          chunks.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array),
          )
        }
        blob = new Blob([Buffer.concat(chunks)], { type: contentType })
      }
      resolved.push({ blob, filename })
      if (item.tags !== undefined || item.metadata !== undefined) {
        fileMetadata[filename] = {
          ...(item.tags !== undefined && { tags: item.tags }),
          ...(item.metadata !== undefined && { metadata: item.metadata }),
        }
      }
    }

    const fd = new FormData()
    if (Object.keys(fileMetadata).length > 0) {
      fd.append('fileMetadata', JSON.stringify(fileMetadata))
    }
    for (const { blob, filename } of resolved) {
      fd.append('files', blob, filename)
    }

    return this.client.request<Document[]>(
      'POST',
      `/collections/${collectionId}/documents/batch`,
      { formData: fd },
    )
  }

  /**
   * Confirm multiple pending documents at once and trigger ingestion.
   * Use after batch-uploading via presigned URLs.
   */
  batchConfirm(
    collectionId: string,
    documents: BatchConfirmDocument[],
  ): Promise<Document[]> {
    return this.client.request<Document[]>(
      'POST',
      `/collections/${collectionId}/documents/batch-confirm`,
      { body: { documents } },
    )
  }

  /** Delete multiple documents in a single request. Returns void on success. */
  batchDelete(collectionId: string, ids: string[]): Promise<void> {
    return this.client.request<void>(
      'DELETE',
      `/collections/${collectionId}/documents/batch`,
      { body: { ids } },
    )
  }

  /**
   * Re-queue all documents in error state in a collection.
   * Returns the updated documents.
   */
  retryFailed(collectionId: string): Promise<Document[]> {
    return this.client.request<Document[]>(
      'POST',
      `/collections/${collectionId}/documents/retry-failed`,
    )
  }

  /**
   * Long-poll until a document reaches `ready` or `error` status.
   * Times out after ~5.5 minutes (returns DeweyError with status 408).
   */
  waitForReady(documentId: string): Promise<Document> {
    return this.client.request<Document>(
      'GET',
      `/documents/${documentId}/wait`,
      { signal: AbortSignal.timeout(330_000) },
    )
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
        tags: item.tags,
        metadata: item.metadata,
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
          body: data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
          ) as ArrayBuffer,
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
