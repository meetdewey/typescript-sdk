<p align="center">
  <a href="https://meetdewey.com">
    <img src="./logo.png" alt="Dewey" width="120" />
  </a>
</p>

# dewey

[![CI](https://github.com/meetdewey/typescript-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/meetdewey/typescript-sdk/actions/workflows/ci.yml)

TypeScript/JavaScript client for the [Dewey](https://meetdewey.com) API. See the [full API reference](https://meetdewey.com/docs) for details on all endpoints and types.

## Installation

```bash
npm install dewey
# or
pnpm add dewey
```

## Quick start

```ts
import { DeweyClient } from 'dewey'

const client = new DeweyClient({ apiKey: 'dwy_live_...' })

// Create a collection
const col = await client.collections.create({ name: 'My Docs' })

// Upload a document
const doc = await client.documents.upload(col.id, file, { filename: 'report.pdf' })

// Query
const results = await client.retrieval.query(col.id, 'What is the refund policy?')

// Research (SSE streaming)
for await (const event of client.research.stream(col.id, 'Summarise key findings')) {
  if (event.type === 'chunk') process.stdout.write(event.content)
  if (event.type === 'done') console.log('\nSources:', event.sources)
}
```

## Constructor

```ts
new DeweyClient({ apiKey: string, baseUrl?: string })
```

| Option    | Default                          | Description               |
| --------- | -------------------------------- | ------------------------- |
| `apiKey`  | —                                | `dwy_live_…` or `dwy_test_…` |
| `baseUrl` | `https://api.meetdewey.com`      | Override for self-hosting |

## Resources

### `client.collections`

| Method                    | Description            |
| ------------------------- | ---------------------- |
| `create(input)`           | Create a collection    |
| `list()`                  | List collections       |
| `get(id)`                 | Get by ID              |
| `update(id, input)`       | Update a collection    |
| `delete(id)`              | Delete a collection    |

`update()` accepts: `name`, `visibility`, `chunkSize`, `chunkOverlap`, `description`, `enableSummarization`, `enableCaptioning`, `llmModel`, `instructions`. All fields are optional; `llmModel` and `instructions` accept `null` to clear the field.

```ts
// Set research instructions for a collection
await client.collections.update(collectionId, {
  instructions: 'All figures are in USD unless stated otherwise.',
})

// Clear instructions
await client.collections.update(collectionId, { instructions: null })
```

### `client.documents`

| Method                                         | Description                            |
| ---------------------------------------------- | -------------------------------------- |
| `upload(collectionId, file, opts?)`            | Multipart upload                       |
| `uploadMany(collectionId, files, opts?)`       | Bulk upload via presigned S3 URLs      |
| `requestUploadUrl(collectionId, input)`        | Get a presigned S3 URL                 |
| `confirm(collectionId, documentId)`            | Confirm presigned upload               |
| `list(collectionId)`                           | List documents                         |
| `get(collectionId, documentId)`                | Get document                           |
| `getMarkdown(collectionId, documentId)`        | Get rendered Markdown (string)         |
| `retry(collectionId, documentId)`              | Retry a failed document                |
| `delete(collectionId, documentId)`             | Delete a document                      |

`upload()` accepts `File`, `Blob`, `Buffer`, or a Node.js `ReadableStream`.

`uploadMany()` is the recommended approach for large datasets. Each file is uploaded directly to S3 (bypassing the API server), so there are no payload-size limits. Files that match an existing document's hash are deduplicated automatically.

```ts
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const dir = './reports'
const names = await readdir(dir)
const files = await Promise.all(
  names
    .filter(n => n.endsWith('.pdf'))
    .map(async n => ({ file: await readFile(path.join(dir, n)), filename: n }))
)

const docs = await client.documents.uploadMany(collectionId, files, {
  concurrency: 10,
  onProgress: (doc, n, total) => console.log(`${n}/${total} ${doc.filename}`),
})
```

### `client.sections`

| Method                                   | Description                   |
| ---------------------------------------- | ----------------------------- |
| `list(collectionId, documentId)`         | List sections for a document  |
| `get(sectionId)`                         | Get section (with content)    |
| `getChunks(sectionId)`                   | Get chunks for a section      |
| `scan(collectionId, query, opts?)`       | Full-text section scan        |

### `client.retrieval`

| Method                              | Description                  |
| ----------------------------------- | ---------------------------- |
| `query(collectionId, q, opts?)`     | Hybrid semantic + FTS search |

### `client.research`

| Method                                    | Description                              |
| ----------------------------------------- | ---------------------------------------- |
| `stream(collectionId, q, opts?)`          | SSE research stream → `AsyncIterable`    |

`stream()` options: `depth` (`'quick'|'balanced'|'deep'|'exhaustive'`), `model` (OpenAI model ID).

### `client.providerKeys`

| Method                        | Description                    |
| ----------------------------- | ------------------------------ |
| `create(projectId, input)`    | Add a provider API key         |
| `list(projectId)`             | List provider keys             |
| `delete(projectId, keyId)`    | Delete a provider key          |

## Error handling

All methods throw `DeweyError` on non-2xx responses:

```ts
import { DeweyError } from 'dewey'

try {
  await client.collections.get('unknown-id')
} catch (err) {
  if (err instanceof DeweyError) {
    console.error(err.status, err.message) // e.g. 404 "Collection not found"
  }
}
```

## Presigned upload flow

For single files or when you need manual control, use the low-level presigned URL flow. For bulk ingestion, prefer `uploadMany()` which handles this automatically with concurrency.

```ts
import { createHash } from 'node:crypto'

const data = await fs.readFile('data.pdf')
const contentHash = createHash('sha256').update(data).digest('hex')

// 1. Request a presigned URL
const { documentId, uploadUrl } = await client.documents.requestUploadUrl(
  collectionId,
  { filename: 'data.pdf', contentType: 'application/pdf', fileSizeBytes: data.byteLength, contentHash },
)

// 2. PUT the file bytes directly to S3 (no auth header needed)
await fetch(uploadUrl, { method: 'PUT', body: data, headers: { 'Content-Type': 'application/pdf' } })

// 3. Confirm to trigger ingestion
const doc = await client.documents.confirm(collectionId, documentId)
```
