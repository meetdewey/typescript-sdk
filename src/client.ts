export class DeweyError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'DeweyError'
    this.status = status
  }
}

export interface DeweyClientOptions {
  apiKey: string
  baseUrl?: string
}

export class BaseClient {
  readonly apiKey: string
  readonly baseUrl: string

  constructor(options: DeweyClientOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = (options.baseUrl ?? 'https://api.meetdewey.com/v1').replace(
      /\/+$/,
      '',
    )
  }

  async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown
      formData?: FormData
      headers?: Record<string, string>
    } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      ...options.headers,
    }

    let body: BodyInit | undefined
    if (options.formData) {
      // Let fetch set the Content-Type with boundary automatically
      body = options.formData
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(options.body)
    }

    const res = await fetch(url, { method, headers, body })

    if (!res.ok) {
      let message = res.statusText
      try {
        const err = (await res.json()) as { message?: string; error?: string }
        message = err.message ?? err.error ?? message
      } catch {
        // ignore parse errors
      }
      throw new DeweyError(res.status, message)
    }

    // 204 No Content
    if (res.status === 204) {
      return undefined as T
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('text/')) {
      return (await res.text()) as unknown as T
    }

    return res.json() as Promise<T>
  }

  async *streamSSE(
    path: string,
    body: unknown,
  ): AsyncGenerator<Record<string, unknown>> {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      let message = res.statusText
      try {
        const err = (await res.json()) as { message?: string; error?: string }
        message = err.message ?? err.error ?? message
      } catch {
        // ignore parse errors
      }
      throw new DeweyError(res.status, message)
    }

    if (!res.body) {
      throw new DeweyError(500, 'No response body for SSE stream')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE messages are separated by double newlines
        const parts = buffer.split('\n\n')
        // Keep the last (potentially incomplete) part in the buffer
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const lines = part.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') return
              try {
                yield JSON.parse(data) as Record<string, unknown>
              } catch {
                // skip malformed lines
              }
            }
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data && data !== '[DONE]') {
              try {
                yield JSON.parse(data) as Record<string, unknown>
              } catch {
                // skip malformed lines
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
