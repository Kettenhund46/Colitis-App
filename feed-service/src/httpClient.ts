import { HTTP_CLIENT_TIMEOUT_MS } from './constants';

export async function fetchWithTimeout(url: string, timeoutMessage: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HTTP_CLIENT_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
