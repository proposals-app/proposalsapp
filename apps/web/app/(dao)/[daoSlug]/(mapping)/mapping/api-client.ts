import type { MappingRequest } from './api-contract';

interface MappingResponse<T> {
  data?: T;
  error?: string;
}

export async function callMappingApi<T = null>(
  request: MappingRequest
): Promise<T> {
  const response = await fetch('/mapping/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const payload = (await response.json()) as MappingResponse<T>;

  if (!response.ok || payload.error) {
    throw new Error(payload.error || 'Mapping request failed');
  }

  return payload.data as T;
}
