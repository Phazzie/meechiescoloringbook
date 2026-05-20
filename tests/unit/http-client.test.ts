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

		it('sends POST request with JSON body and returns parsed response', async () => {
			const mockPayload = { ok: true, value: 'test' };
			const mockResponse = {
				status: 200,
				json: () => Promise.resolve(mockPayload)
			} as unknown as Response;

			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(mockResponse)
			);

			const result = await postJson('/api/test', { input: 'data' });
			expect(result.response).toBe(mockResponse);
			expect(result.payload).toEqual(mockPayload);

			const fetchCall = vi.mocked(fetch).mock.calls[0];
			expect(fetchCall[0]).toBe('/api/test');
			expect(fetchCall[1]?.method).toBe('POST');
			expect(fetchCall[1]?.body).toBe(JSON.stringify({ input: 'data' }));

			const sentHeaders = fetchCall[1]?.headers as Record<string, string>;
			expect(sentHeaders['Content-Type']).toBe('application/json');
		});

		it('returns parsed payload even for non-2xx responses', async () => {
			const mockPayload = { ok: false, error: { message: 'Provider failed' } };
			const mockResponse = {
				status: 502,
				json: () => Promise.resolve(mockPayload)
			} as unknown as Response;

			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(mockResponse)
			);

			const result = await postJson('/api/test', {});
			expect(result.response).toBe(mockResponse);
			expect(result.payload).toEqual(mockPayload);
		});

		it('throws with URL and status when response JSON parsing fails', async () => {
			const mockResponse = {
				status: 500,
				json: () => Promise.reject(new Error('bad json'))
			} as unknown as Response;

			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(mockResponse)
			);

			await expect(postJson('/api/test', {})).rejects.toThrow(
				'postJson [/api/test]: HTTP 500 - failed to parse JSON response'
			);
		});
	});
});
