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

		it('returns null payload when response JSON parsing fails', async () => {
			const mockResponse = {
				json: () => Promise.reject(new Error('bad json')),
				status: 500
			} as unknown as Response;

			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(mockResponse)
			);

			const result = await postJson('/api/test', {});
			expect(result.response).toBe(mockResponse);
			expect(result.payload).toBeNull();
		});
	});
});
