// Purpose: Unit tests for provider-adapter internal helper functions.
// Why: Ensure URL normalization, error building, and output normalization behave correctly.
// Info flow: Helper inputs -> function logic -> verified outputs.
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { createProviderAdapter } from '../../src/lib/adapters/provider-adapter.adapter';

const jsonResponse = (payload: unknown, status = 200): Response =>
	new Response(JSON.stringify(payload), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('provider-adapter helpers', () => {
	describe('normalizeBaseUrl via adapter behavior', () => {
		it('strips trailing slash from base URL', async () => {
			const fetchMock = vi.fn(async () =>
				jsonResponse({
					model: 'test-model',
					choices: [{ message: { content: 'hello' } }]
				})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai/'
			});
			await adapter.createChatCompletion({
				model: 'test-model',
				messages: [{ role: 'user', content: 'hi' }]
			});

			expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
			const firstCall = fetchMock.mock.calls.at(0) as unknown[] | undefined;
			const calledUrl = String(firstCall?.at(0) ?? '');
			expect(calledUrl).toBe('https://api.x.ai/v1/chat/completions');
		});

		it('strips trailing /v1 from base URL', async () => {
			const fetchMock = vi.fn(async () =>
				jsonResponse({
					model: 'test-model',
					choices: [{ message: { content: 'hello' } }]
				})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai/v1'
			});
			await adapter.createChatCompletion({
				model: 'test-model',
				messages: [{ role: 'user', content: 'hi' }]
			});

			expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
			const firstCall = fetchMock.mock.calls.at(0) as unknown[] | undefined;
			const calledUrl = String(firstCall?.at(0) ?? '');
			expect(calledUrl).toBe('https://api.x.ai/v1/chat/completions');
		});

		it('strips trailing /v1/ from base URL', async () => {
			const fetchMock = vi.fn(async () =>
				jsonResponse({
					model: 'test-model',
					choices: [{ message: { content: 'hello' } }]
				})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai/v1/'
			});
			await adapter.createChatCompletion({
				model: 'test-model',
				messages: [{ role: 'user', content: 'hi' }]
			});

			expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
			const firstCall = fetchMock.mock.calls.at(0) as unknown[] | undefined;
			const calledUrl = String(firstCall?.at(0) ?? '');
			expect(calledUrl).toBe('https://api.x.ai/v1/chat/completions');
		});
	});

	describe('missing API key', () => {
		it('returns PROVIDER_API_KEY_MISSING for chat when no key provided', async () => {
			const adapter = createProviderAdapter({ apiKey: '' });
			const result = await adapter.createChatCompletion({
				model: 'test',
				messages: [{ role: 'user', content: 'hi' }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('PROVIDER_API_KEY_MISSING');
			}
		});

		it('returns PROVIDER_API_KEY_MISSING for image when no key provided', async () => {
			const adapter = createProviderAdapter({ apiKey: '' });
			const result = await adapter.createImageGeneration({
				model: 'test',
				prompt: 'test',
				n: 1,
				responseFormat: 'b64_json'
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('PROVIDER_API_KEY_MISSING');
			}
		});
	});

	describe('normalizeChatOutput edge cases', () => {
		it('returns empty chat error when content is whitespace only', async () => {
			const fetchMock = vi.fn(async () =>
				jsonResponse({
					model: 'test-model',
					choices: [{ message: { content: '   ' } }]
				})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createChatCompletion({
				model: 'test-model',
				messages: [{ role: 'user', content: 'hi' }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('PROVIDER_EMPTY_CHAT');
			}
		});

		it('returns empty chat error when choices array is empty', async () => {
			const fetchMock = vi.fn(async () =>
				jsonResponse({
					model: 'test-model',
					choices: []
				})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createChatCompletion({
				model: 'test-model',
				messages: [{ role: 'user', content: 'hi' }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('PROVIDER_EMPTY_CHAT');
			}
		});

		it('uses text field as fallback when message.content is missing', async () => {
			const fetchMock = vi.fn(async () =>
				jsonResponse({
					model: 'test-model',
					choices: [{ text: 'fallback text content' }]
				})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createChatCompletion({
				model: 'test-model',
				messages: [{ role: 'user', content: 'hi' }]
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.content).toBe('fallback text content');
			}
		});

		it('uses fallback model when response does not include model', async () => {
			const fetchMock = vi.fn(async () =>
				jsonResponse({
					choices: [{ message: { content: 'hello' } }]
				})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createChatCompletion({
				model: 'my-fallback-model',
				messages: [{ role: 'user', content: 'hi' }]
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.model).toBe('my-fallback-model');
			}
		});

		it('passes response_format through for structured chat output', async () => {
			const fetchMock = vi.fn(async () =>
				jsonResponse({
					model: 'test-model',
					choices: [{ message: { content: '{"ok":true}' } }]
				})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			await adapter.createChatCompletion({
				model: 'test-model',
				messages: [{ role: 'user', content: 'hi' }],
				responseFormat: {
					type: 'json_schema',
					json_schema: {
						name: 'test_schema',
						schema: { type: 'object' }
					}
				}
			});

			const firstCall = fetchMock.mock.calls.at(0) as unknown[] | undefined;
			const init = firstCall?.at(1) as RequestInit | undefined;
			const body = JSON.parse(String(init?.body));
			expect(body.response_format).toMatchObject({
				type: 'json_schema',
				json_schema: { name: 'test_schema' }
			});
		});
	});

	describe('normalizeImageOutput edge cases', () => {
		it('does not retry image generation POSTs on retryable HTTP failure', async () => {
			vi.useFakeTimers();
			try {
				const fetchMock = vi.fn(
					async () =>
						new Response(JSON.stringify({ error: { message: 'temporary provider failure' } }), {
							status: 503,
							statusText: 'Service Unavailable'
						})
				);
				vi.stubGlobal('fetch', fetchMock);

				const adapter = createProviderAdapter({
					apiKey: 'test-key',
					baseUrl: 'https://api.x.ai'
				});
				const promise = adapter.createImageGeneration({
					model: 'test',
					prompt: 'test',
					n: 1,
					responseFormat: 'b64_json'
				});
				await vi.runAllTimersAsync();
				const result = await promise;

				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.error.code).toBe('PROVIDER_HTTP_ERROR');
					expect(result.error.message).toBe('temporary provider failure');
				}
				expect(fetchMock).toHaveBeenCalledTimes(1);
			} finally {
				vi.useRealTimers();
			}
		});

		it('returns empty image error when data array has no usable entries', async () => {
			const fetchMock = vi.fn(async () =>
				jsonResponse({
					data: [{ not_a_url: 'something' }]
				})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createImageGeneration({
				model: 'test',
				prompt: 'test',
				n: 1,
				responseFormat: 'b64_json'
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('PROVIDER_EMPTY_IMAGE');
			}
		});

		it('returns empty image error when data is not an array', async () => {
			const fetchMock = vi.fn(async () =>
				jsonResponse({
					data: 'not-an-array'
				})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createImageGeneration({
				model: 'test',
				prompt: 'test',
				n: 1,
				responseFormat: 'b64_json'
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('PROVIDER_EMPTY_IMAGE');
			}
		});

		it('extracts revised_prompt from top level', async () => {
			const fetchMock = vi.fn(async () =>
				jsonResponse({
					data: [{ url: 'https://example.com/image.png' }],
					revised_prompt: 'top-level revised'
				})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createImageGeneration({
				model: 'test',
				prompt: 'test',
				n: 1,
				responseFormat: 'url'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.revisedPrompt).toBe('top-level revised');
			}
		});

		it('extracts revisedPrompt from camelCase field', async () => {
			const fetchMock = vi.fn(async () =>
				jsonResponse({
					data: [{ url: 'https://example.com/image.png' }],
					revisedPrompt: 'camelCase revised'
				})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createImageGeneration({
				model: 'test',
				prompt: 'test',
				n: 1,
				responseFormat: 'url'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.revisedPrompt).toBe('camelCase revised');
			}
		});

		it('extracts revised_prompt from data entry when top-level is missing', async () => {
			const fetchMock = vi.fn(async () =>
				jsonResponse({
					data: [
						{
							url: 'https://example.com/image.png',
							revised_prompt: 'entry-level revised'
						}
					]
				})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createImageGeneration({
				model: 'test',
				prompt: 'test',
				n: 1,
				responseFormat: 'url'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.revisedPrompt).toBe('entry-level revised');
			}
		});

		it('returns undefined revisedPrompt when none available', async () => {
			const fetchMock = vi.fn(async () =>
				jsonResponse({
					data: [{ url: 'https://example.com/image.png' }]
				})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createImageGeneration({
				model: 'test',
				prompt: 'test',
				n: 1,
				responseFormat: 'url'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.revisedPrompt).toBeUndefined();
			}
		});
	});

	describe('buildHttpError edge cases', () => {
		it('extracts error message from error.message field', async () => {
			const fetchMock = vi.fn(
				async () =>
					new Response(
						JSON.stringify({ error: { message: 'Custom API error' } }),
						{ status: 429, statusText: 'Too Many Requests' }
					)
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createChatCompletion({
				model: 'test',
				messages: [{ role: 'user', content: 'hi' }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('PROVIDER_HTTP_ERROR');
				expect(result.error.message).toBe('Custom API error');
				expect(result.error.details?.status).toBe('429');
			}
		});

		it('uses statusText when response body has no message', async () => {
			const fetchMock = vi.fn(
				async () =>
					new Response(JSON.stringify({}), {
						status: 500,
						statusText: 'Internal Server Error'
					})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createChatCompletion({
				model: 'test',
				messages: [{ role: 'user', content: 'hi' }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toBe('Internal Server Error');
			}
		});

		it('generates fallback message when body and statusText are empty', async () => {
			const fetchMock = vi.fn(
				async () => new Response('', { status: 503, statusText: '' })
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createChatCompletion({
				model: 'test',
				messages: [{ role: 'user', content: 'hi' }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain('503');
			}
		});

		it('extracts top-level message field as fallback', async () => {
			const fetchMock = vi.fn(
				async () =>
					new Response(JSON.stringify({ message: 'Top-level error message' }), {
						status: 403,
						statusText: 'Forbidden'
					})
			);
			vi.stubGlobal('fetch', fetchMock);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createChatCompletion({
				model: 'test',
				messages: [{ role: 'user', content: 'hi' }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toBe('Top-level error message');
			}
		});
	});

	describe('network error handling', () => {
		it('returns PROVIDER_NETWORK_ERROR for chat when fetch throws', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
			);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createChatCompletion({
				model: 'test',
				messages: [{ role: 'user', content: 'hi' }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('PROVIDER_NETWORK_ERROR');
				expect(result.error.message).toBe('ECONNREFUSED');
			}
		});

		it('returns PROVIDER_NETWORK_ERROR for image when fetch throws', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockRejectedValue(new Error('DNS lookup failed'))
			);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createImageGeneration({
				model: 'test',
				prompt: 'test',
				n: 1,
				responseFormat: 'b64_json'
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('PROVIDER_NETWORK_ERROR');
				expect(result.error.message).toBe('DNS lookup failed');
			}
		});

		it('rewrites a named TimeoutError into a fixed chat timeout message', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' }))
			);

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createChatCompletion({
				model: 'test',
				messages: [{ role: 'user', content: 'hi' }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('PROVIDER_NETWORK_ERROR');
				expect(result.error.message).toBe('Chat completion request timed out.');
			}
		});

		it('returns generic message when non-Error is thrown', async () => {
			vi.stubGlobal('fetch', vi.fn().mockRejectedValue('string error'));

			const adapter = createProviderAdapter({
				apiKey: 'test-key',
				baseUrl: 'https://api.x.ai'
			});
			const result = await adapter.createChatCompletion({
				model: 'test',
				messages: [{ role: 'user', content: 'hi' }]
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toBe('Provider request failed.');
			}
		});
	});
});
