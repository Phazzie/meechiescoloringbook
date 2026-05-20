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
				json: () => Promise.resolve(mockPayload),
				status: 200
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

		it('throws when response JSON parsing fails', async () => {
			const mockResponse = {
				json: () => Promise.reject(new Error('bad json')),
				status: 500
			} as unknown as Response;

			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(mockResponse)
			);

			await expect(postJson('/api/test', {})).rejects.toThrow(
				'postJson: failed to parse JSON response'
			);
		});

		it('includes the url in the JSON parse error message', async () => {
			const mockResponse = {
				json: () => Promise.reject(new Error('bad json')),
				status: 200
			} as unknown as Response;

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			await expect(postJson('/api/specific-endpoint', {})).rejects.toThrow(
				'url /api/specific-endpoint'
			);
		});

		it('includes the response status in the JSON parse error message', async () => {
			const mockResponse = {
				json: () => Promise.reject(new Error('bad json')),
				status: 503
			} as unknown as Response;

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			await expect(postJson('/api/test', {})).rejects.toThrow('status 503');
		});

		it('error message includes both url and status when JSON parsing fails', async () => {
			const mockResponse = {
				json: () => Promise.reject(new Error('bad json')),
				status: 422
			} as unknown as Response;

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

			await expect(postJson('/api/my-endpoint', {})).rejects.toThrow(
				'postJson: failed to parse JSON response (url /api/my-endpoint, status 422)'
			);
		});
	});
});
