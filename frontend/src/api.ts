export async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.toLowerCase().includes('application/json')) {
    return response.json() as Promise<T>;
  }

  const text = await response.text();
  const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 160);
  const detail = snippet ? `: ${snippet}` : '';
  throw new Error(`${fallbackMessage} (HTTP ${response.status}, non-JSON response${detail})`);
}

export async function fetchJson<T>(input: RequestInfo | URL, init: RequestInit | undefined, fallbackMessage: string): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    try {
      const error = await readJsonResponse<{ error?: string }>(response, fallbackMessage);
      throw new Error(error.error || `${fallbackMessage} (HTTP ${response.status})`);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(`${fallbackMessage} (HTTP ${response.status})`);
    }
  }

  return readJsonResponse<T>(response, fallbackMessage);
}
