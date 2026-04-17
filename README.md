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

| Method                          | Description                                      |
| ------------------------------- | ------------------------------------------------ |
| `create(input)`                 | Create a collection                              |
| `list()`                        | List collections                                 |
| `get(id)`                       | Get by ID                                        |
| `update(id, input)`             | Update a collection                              |
| `delete(id)`                    | Delete a collection                              |
| `stats(id)`                     | Document count, storage, section/chunk/claim counts |
| `recomputeSummaries(id)`        | Re-run AI section summarization                  |
| `recomputeCaptions(id)`         | Re-run AI captioning for images and tables       |
| `recomputeClaims(id)`           | Re-extract factual claims (clears existing)      |

`update()` accepts: `name`, `visibility`, `chunkSize`, `chunkOverlap`, `description`, `enableSummarization`, `enableCaptioning`, `llmModel`, `instructions`. All fields are optional; `llmModel` and `instructions` accept `null` to clear the field.

```ts
// Set research instructions for a collection
await client.collections.update(collectionId, {
  instructions: 'All figures are in USD unless stated otherwise.',
})

// Clear instructions
await client.collections.update(collectionId, { instructions: null })

// Get collection statistics
const stats = await client.collections.stats(collectionId)
console.log(`${stats.docCount} docs, ${stats.totalClaimsCount} claims`)
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

### `client.claims`

| Method                                          | Description                                  |
| ----------------------------------------------- | -------------------------------------------- |
| `mapStream(collectionId)`                       | SSE stream of all claims with UMAP coordinates |
| `listByDocument(documentId, opts?)`             | Claims extracted from a specific document    |

`mapStream()` yields `ClaimMapEvent` objects: `{ type: 'progress', pct }`, `{ type: 'done', total, claims }`, or `{ type: 'error', message }`.

```ts
for await (const event of client.claims.mapStream(collectionId)) {
  if (event.type === 'done') {
    console.log(`${event.total} claims`)
    for (const claim of event.claims) {
      console.log(`[${claim.importance}] ${claim.text}`)
    }
  }
}

// Per-document claims (fast, no SSE)
const { claims } = await client.claims.listByDocument(documentId, { minImportance: 3 })
```

### `client.contradictions`

| Method                                                          | Description                                         |
| --------------------------------------------------------------- | --------------------------------------------------- |
| `list(collectionId, opts?)`                                     | List detected contradictions                        |
| `detect(collectionId)`                                          | Trigger async contradiction detection run           |
| `getLatestRun(collectionId)`                                    | Poll status of the latest detection run             |
| `dismiss(collectionId, contradictionId)`                        | Mark a contradiction as ignored                     |
| `applyInstruction(collectionId, contradictionId, instruction?)` | Apply resolution; appends to collection instructions |

```ts
// Trigger detection, then poll
const run = await client.contradictions.detect(collectionId)
console.log('Run ID:', run.runId)

// Later: poll status
const status = await client.contradictions.getLatestRun(collectionId)
console.log(status.status, status.contradictionsFound)

// List active contradictions
const { items } = await client.contradictions.list(collectionId, { status: 'active' })
for (const c of items) {
  console.log(c.severity, c.explanation)
  // Apply the suggested resolution
  await client.contradictions.applyInstruction(collectionId, c.id)
}
```

### `client.duplicates`

Fuzzy document deduplication. Identifies near-duplicate documents by measuring how much content they share, marks one member of each cluster as canonical, and excludes near-duplicates from retrieval and contradiction detection. Must be enabled per-collection with `client.collections.update(id, { enableDeduplication: true })`.

| Method                                                       | Description                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `detect(collectionId)`                                       | Trigger async dedup run across all ready documents                   |
| `getLatestRun(collectionId)`                                 | Poll status of the latest dedup run                                  |
| `list(collectionId, opts?)`                                  | List duplicate groups with members and coverage percentages          |
| `promoteCanonical(collectionId, groupId, canonicalDocumentId)` | Promote a different member to canonical; old canonical becomes near_duplicate |
| `disband(collectionId, groupId)`                             | Disband a group; all former members rejoin retrieval as distinct     |

```ts
// Enable on a collection (one-time)
await client.collections.update(collectionId, { enableDeduplication: true })

// Trigger detection, then poll
const run = await client.duplicates.detect(collectionId)
const status = await client.duplicates.getLatestRun(collectionId)
console.log(status.status, status.duplicateGroupsCreated)

// Review groups
const { items } = await client.duplicates.list(collectionId)
for (const group of items) {
  for (const m of group.members) {
    if (m.relationship === 'near_duplicate') {
      console.log(`${m.filename} covers ${Math.round((m.coverageToCanonical ?? 0) * 100)}% of canonical`)
    }
  }
}
```

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
