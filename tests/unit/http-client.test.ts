// Purpose: Unit tests for http-client browser helpers.
// Why: Ensure JSON header construction and request helpers are correct.
// Info flow: Function calls -> header map / fetch -> assertions.
import { describe, expect, it, afterEach, vi } from 'vitest';
import {
	buildJsonHeaders,
	postJson
} from '../../src/lib/core/http-client';

describe('http-client', () => {
	describe('buildJsonHeaders', () => {
		it('returns Content-Type header', () => {
			const headers = buildJsonHeaders();
			expect(headers['Content-Type']).toBe('application/json');
		});
	});

	describe('postJson', () => {
		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it('sends POST request with JSON body and returns parsed payload', async () => {
			const mockPayload = { ok: true, value: 'test' };
			const mockResponse = {
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockPayload)
			} as unknown as Response;

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
			const jsonSpy = vi.fn();
			const mockResponse = {
				ok: true,
				status: 204,
				json: jsonSpy
			} as unknown as Response;

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			const result = await postJson('/api/test', {});
			expect(result).toBeUndefined();
			expect(jsonSpy).not.toHaveBeenCalled();
		});

		it('throws preserving structured error message from non-OK JSON body', async () => {
			const mockResponse = {
				ok: false,
				status: 400,
				statusText: 'Bad Request',
				json: () => Promise.resolve({ error: { message: 'Prompt missing required field' } })
			} as unknown as Response;

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			await expect(postJson('/api/test', {})).rejects.toThrow('Prompt missing required field');
		});

		it('throws HTTP status error when non-OK response has no structured error body', async () => {
			const mockResponse = {
				ok: false,
				status: 502,
				statusText: 'Bad Gateway',
				json: () => Promise.resolve({ someOtherField: 'data' })
			} as unknown as Response;

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			await expect(postJson('/api/test', {})).rejects.toThrow('postJson: HTTP 502 Bad Gateway');
		});

		it('throws with parse error details when JSON parsing fails', async () => {
			const mockResponse = {
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				json: () => Promise.reject(new Error('bad json'))
			} as unknown as Response;

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			await expect(postJson('/api/test', {})).rejects.toThrow(
				'postJson: failed to parse JSON response (HTTP 500): bad json'
			);
		});
	});
});
