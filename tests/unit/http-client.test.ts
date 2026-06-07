// Purpose: Unit tests for http-client browser helpers.
// Why: Ensure JSON header construction and request helpers are correct.
// Info flow: Function calls -> header map / fetch -> assertions.
import { describe, expect, it, afterEach, vi } from 'vitest';
import {
	buildJsonHeaders,
	postJson
} from '../../src/lib/core/http-client';

describe('http-client', () => {
	const jsonResponse = (payload: unknown, init?: ResponseInit): Response =>
		new Response(JSON.stringify(payload), init);

	describe('buildJsonHeaders', () => {
		it('returns Content-Type header', () => {
			const headers = buildJsonHeaders();
			expect(headers['Content-Type']).toBe('application/json');
		});
	});

	describe('postJson', () => {
		afterEach(() => {
			vi.useRealTimers();
			vi.unstubAllGlobals();
		});

		it('sends POST request with JSON body and returns parsed payload', async () => {
			const mockPayload = { ok: true, value: 'test' };
			const mockResponse = jsonResponse(mockPayload, { status: 200, statusText: 'OK' });

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			const result = await postJson('/api/test', { input: 'data' });
			expect(result).toEqual(mockPayload);

			const fetchCall = vi.mocked(fetch).mock.calls[0];
			expect(fetchCall[0]).toBe('/api/test');
			expect(fetchCall[1]?.method).toBe('POST');
			expect(fetchCall[1]?.body).toBe(JSON.stringify({ input: 'data' }));

			const sentHeaders = fetchCall[1]?.headers as Record<string, string>;
			expect(sentHeaders['Content-Type']).toBe('application/json');
		});

		it('returns undefined for 204 No Content without parsing body', async () => {
			const textSpy = vi.fn();
			const jsonSpy = vi.fn();
			const mockResponse = {
				ok: true,
				status: 204,
				statusText: 'No Content',
				text: textSpy,
				json: jsonSpy
			} as unknown as Response;

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			const result = await postJson('/api/test', {});
			expect(result).toBeUndefined();
			expect(textSpy).not.toHaveBeenCalled();
			expect(jsonSpy).not.toHaveBeenCalled();
		});

		it('returns undefined for 205 Reset Content without parsing body', async () => {
			const textSpy = vi.fn();
			const jsonSpy = vi.fn();
			const mockResponse = {
				ok: true,
				status: 205,
				statusText: 'Reset Content',
				text: textSpy,
				json: jsonSpy
			} as unknown as Response;

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			const result = await postJson('/api/test', {});
			expect(result).toBeUndefined();
			expect(textSpy).not.toHaveBeenCalled();
			expect(jsonSpy).not.toHaveBeenCalled();
		});

		it('returns undefined when an OK response has an empty body', async () => {
			const mockResponse = new Response('', { status: 200, statusText: 'OK' });

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			const result = await postJson('/api/test', {});
			expect(result).toBeUndefined();
		});

		it('returns contract-shaped JSON from non-OK responses', async () => {
			const payload = {
				ok: false,
				error: { code: 'VALIDATION_FAILED', message: 'Prompt missing required field' }
			};
			const mockResponse = jsonResponse(payload, {
				status: 400,
				statusText: 'Bad Request'
			});

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			await expect(postJson('/api/test', {})).resolves.toEqual(payload);
		});

		it('returns any JSON body from non-OK responses without requiring a structured error', async () => {
			const payload = { someOtherField: 'data' };
			const mockResponse = jsonResponse(payload, {
				status: 502,
				statusText: 'Bad Gateway'
			});

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			await expect(postJson('/api/test', {})).resolves.toEqual(payload);
		});

		it('throws rich parse details when a non-OK response is not JSON', async () => {
			const mockResponse = new Response('not json', {
				status: 502,
				statusText: 'Bad Gateway'
			});

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			await expect(postJson('/api/test', {})).rejects.toThrow(
				/postJson: HTTP 502 Bad Gateway from \/api\/test: failed to parse JSON response: .*?(not valid JSON|Unexpected token)/
			);
		});

		it('throws rich parse details when an OK response is not JSON', async () => {
			const mockResponse = new Response('not json', { status: 200, statusText: 'OK' });

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			await expect(postJson('/api/test', {})).rejects.toThrow(
				/postJson: failed to parse JSON response from \/api\/test \(HTTP 200 OK\): .*?(not valid JSON|Unexpected token)/
			);
		});

		it('throws rich status details when a non-OK response has an empty body', async () => {
			const mockResponse = new Response('', { status: 503, statusText: 'Service Unavailable' });

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			await expect(postJson('/api/test', {})).rejects.toThrow(
				'postJson: HTTP 503 Service Unavailable from /api/test: empty response body'
			);
		});

		it('rejects with a user-readable timeout when timeoutMs elapses', async () => {
			vi.useFakeTimers();
			vi.stubGlobal(
				'fetch',
				vi.fn().mockImplementation((_url: string, init: RequestInit) => {
					return new Promise<Response>((_, reject) => {
						init.signal?.addEventListener('abort', () => {
							reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
						});
					});
				})
			);

			const request = postJson('/api/test', {}, { timeoutMs: 1_000 }).catch((error) => error);
			await vi.advanceTimersByTimeAsync(1_001);
			const result = await Promise.race([request, Promise.resolve('still pending')]);

			expect(result).toBeInstanceOf(Error);
			expect((result as Error).message).toBe(
				'Request timed out after 1s. The AI took too long to respond - please try again.'
			);
		});

		it('passes an abort signal to fetch when timeoutMs is set and returns parsed payload', async () => {
			const mockPayload = { ok: true, value: 'fast response' };
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(jsonResponse(mockPayload, { status: 200, statusText: 'OK' }))
			);

			const result = await postJson('/api/test', { input: 'data' }, { timeoutMs: 5_000 });

			expect(result).toEqual(mockPayload);
			const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
			expect(init.signal).toBeInstanceOf(AbortSignal);
		});

		it('returns non-OK JSON payloads when timeoutMs is set', async () => {
			const payload = {
				ok: false,
				error: { code: 'VALIDATION_FAILED', message: 'Prompt missing required field' }
			};
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(jsonResponse(payload, { status: 400, statusText: 'Bad Request' }))
			);

			await expect(postJson('/api/test', {}, { timeoutMs: 5_000 })).resolves.toEqual(payload);
			const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
			expect(init.signal).toBeInstanceOf(AbortSignal);
		});

		it('rethrows browser AbortError unchanged when no timeoutMs is set', async () => {
			const abortError = Object.assign(new Error('The user aborted a request.'), {
				name: 'AbortError'
			});
			vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

			await expect(postJson('/api/test', {})).rejects.toThrow('The user aborted a request.');
		});
	});
});
