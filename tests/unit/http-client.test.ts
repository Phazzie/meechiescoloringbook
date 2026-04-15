// Purpose: Unit tests for http-client browser helpers.
// Why: Ensure API-key storage and JSON header construction are correct.
// Info flow: Function calls -> localStorage / header map -> assertions.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
	TEMP_API_KEY_STORAGE_KEY,
	loadStoredApiKey,
	saveStoredApiKey,
	clearStoredApiKey,
	buildJsonHeaders,
	postJson
} from '../../src/lib/core/http-client';

describe('http-client', () => {
	describe('buildJsonHeaders', () => {
		it('returns Content-Type header with no API key', () => {
			const headers = buildJsonHeaders();
			expect(headers['Content-Type']).toBe('application/json');
			expect(headers['x-api-key']).toBeUndefined();
		});

		it('includes x-api-key when provided', () => {
			const headers = buildJsonHeaders('test-key-123');
			expect(headers['Content-Type']).toBe('application/json');
			expect(headers['x-api-key']).toBe('test-key-123');
		});

		it('trims whitespace from API key', () => {
			const headers = buildJsonHeaders('  spaced-key  ');
			expect(headers['x-api-key']).toBe('spaced-key');
		});

		it('does not include x-api-key for empty string', () => {
			const headers = buildJsonHeaders('');
			expect(headers['x-api-key']).toBeUndefined();
		});

		it('does not include x-api-key for whitespace-only string', () => {
			const headers = buildJsonHeaders('   ');
			expect(headers['x-api-key']).toBeUndefined();
		});

		it('does not include x-api-key for undefined', () => {
			const headers = buildJsonHeaders(undefined);
			expect(headers['x-api-key']).toBeUndefined();
		});
	});

	describe('localStorage helpers', () => {
		beforeEach(() => {
			window.localStorage.clear();
		});

		it('loadStoredApiKey returns empty string when no key is stored', () => {
			expect(loadStoredApiKey()).toBe('');
		});

		it('saveStoredApiKey stores and loadStoredApiKey retrieves the key', () => {
			saveStoredApiKey('my-secret-key');
			expect(loadStoredApiKey()).toBe('my-secret-key');
		});

		it('saveStoredApiKey trims whitespace', () => {
			saveStoredApiKey('  padded-key  ');
			const stored = window.localStorage.getItem(TEMP_API_KEY_STORAGE_KEY);
			expect(stored).toBe('padded-key');
		});

		it('clearStoredApiKey removes the stored key', () => {
			saveStoredApiKey('to-be-removed');
			clearStoredApiKey();
			expect(loadStoredApiKey()).toBe('');
		});

		it('TEMP_API_KEY_STORAGE_KEY is a non-empty string', () => {
			expect(typeof TEMP_API_KEY_STORAGE_KEY).toBe('string');
			expect(TEMP_API_KEY_STORAGE_KEY.length).toBeGreaterThan(0);
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

			const result = await postJson('/api/test', { input: 'data' }, 'api-key');
			expect(result.response).toBe(mockResponse);
			expect(result.payload).toEqual(mockPayload);

			const fetchCall = vi.mocked(fetch).mock.calls[0];
			expect(fetchCall[0]).toBe('/api/test');
			expect(fetchCall[1]?.method).toBe('POST');
			expect(fetchCall[1]?.body).toBe(JSON.stringify({ input: 'data' }));

			const sentHeaders = fetchCall[1]?.headers as Record<string, string>;
			expect(sentHeaders['Content-Type']).toBe('application/json');
			expect(sentHeaders['x-api-key']).toBe('api-key');
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

		it('sends request without x-api-key when not provided', async () => {
			const mockResponse = {
				json: () => Promise.resolve({}),
				status: 200
			} as unknown as Response;

			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(mockResponse)
			);

			await postJson('/api/test', {});

			const fetchCall = vi.mocked(fetch).mock.calls[0];
			const sentHeaders = fetchCall[1]?.headers as Record<string, string>;
			expect(sentHeaders['x-api-key']).toBeUndefined();
		});
	});
});
