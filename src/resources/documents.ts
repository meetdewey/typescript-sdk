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
}
