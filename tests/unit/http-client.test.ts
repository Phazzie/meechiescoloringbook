// Purpose: Unit tests for http-client helpers.
// Why: Verify API-key storage, header construction, and postJson behavior without I/O.
// Info flow: Test cases -> localStorage stub / fetch stub -> assertions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	TEMP_API_KEY_STORAGE_KEY,
	buildJsonHeaders,
	clearStoredApiKey,
	loadStoredApiKey,
	postJson,
	saveStoredApiKey
} from '../../src/lib/core/http-client';

describe('http-client', () => {
	describe('buildJsonHeaders', () => {
		it('returns Content-Type header when no API key provided', () => {
			const headers = buildJsonHeaders();
			expect(headers).toEqual({ 'Content-Type': 'application/json' });
		});

		it('returns Content-Type header when API key is empty string', () => {
			const headers = buildJsonHeaders('');
			expect(headers).toEqual({ 'Content-Type': 'application/json' });
		});

		it('returns Content-Type header when API key is only whitespace', () => {
			const headers = buildJsonHeaders('   ');
			expect(headers).toEqual({ 'Content-Type': 'application/json' });
		});

		it('includes x-api-key when non-empty API key is provided', () => {
			const headers = buildJsonHeaders('my-api-key');
			expect(headers).toEqual({
				'Content-Type': 'application/json',
				'x-api-key': 'my-api-key'
			});
		});

		it('trims whitespace from API key before including it', () => {
			const headers = buildJsonHeaders('  trimmed-key  ');
			expect(headers['x-api-key']).toBe('trimmed-key');
		});
	});

	describe('localStorage helpers', () => {
		beforeEach(() => {
			localStorage.clear();
		});

		it('loadStoredApiKey returns empty string when nothing is stored', () => {
			expect(loadStoredApiKey()).toBe('');
		});

		it('saveStoredApiKey persists trimmed value to localStorage', () => {
			saveStoredApiKey('  test-key  ');
			expect(localStorage.getItem(TEMP_API_KEY_STORAGE_KEY)).toBe('test-key');
		});

		it('loadStoredApiKey retrieves a previously saved key', () => {
			saveStoredApiKey('my-stored-key');
			expect(loadStoredApiKey()).toBe('my-stored-key');
		});

		it('clearStoredApiKey removes the stored key', () => {
			saveStoredApiKey('some-key');
			clearStoredApiKey();
			expect(loadStoredApiKey()).toBe('');
		});
	});

	describe('postJson', () => {
		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it('sends a POST request with JSON body and Content-Type header', async () => {
			let capturedInit: RequestInit | undefined;
			const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				capturedInit = init;
				return new Response('{"result":"ok"}', { status: 200 });
			});
			vi.stubGlobal('fetch', mockFetch);

			await postJson('/api/test', { foo: 'bar' });

			expect(mockFetch).toHaveBeenCalledOnce();
			expect(mockFetch).toHaveBeenCalledWith(
				'/api/test',
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify({ foo: 'bar' })
				})
			);
			expect((capturedInit?.headers as Record<string, string>)?.['Content-Type']).toBe(
				'application/json'
			);
		});

		it('includes x-api-key header when API key is provided', async () => {
			let capturedInit: RequestInit | undefined;
			const mockFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
				capturedInit = init;
				return new Response('{}', { status: 200 });
			});
			vi.stubGlobal('fetch', mockFetch);

			await postJson('/api/test', {}, 'secret-key');

			expect((capturedInit?.headers as Record<string, string>)?.['x-api-key']).toBe('secret-key');
		});

		it('returns parsed JSON payload on success', async () => {
			vi.stubGlobal('fetch', async () => new Response('{"value":42}', { status: 200 }));

			const { response, payload } = await postJson('/api/test', {});

			expect(response.status).toBe(200);
			expect(payload).toEqual({ value: 42 });
		});

		it('returns null payload when response body is not valid JSON', async () => {
			vi.stubGlobal('fetch', async () => new Response('not-json', { status: 500 }));

			const { payload } = await postJson('/api/test', {});

			expect(payload).toBeNull();
		});
	});
});
