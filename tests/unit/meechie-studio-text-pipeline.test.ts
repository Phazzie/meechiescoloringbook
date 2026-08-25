/*
 * Purpose: Unit tests for runMeechieStudioTextPipeline.
 * Why: Ensure the pipeline rejects invalid input, disallowed content, and handles provider errors.
 * Info flow: Test inputs -> runMeechieStudioTextPipeline -> assertions.
 */
import { describe, expect, it } from 'vitest';
import { runMeechieStudioTextPipeline } from '../../src/lib/core/meechie-studio-text-pipeline';
import type { MeechieStudioTextPipelineDeps } from '../../src/lib/core/meechie-studio-text-pipeline';
import { TEXT_MODEL } from '../../src/lib/core/models';
import { meechieVoicePack } from '../../src/lib/seams/meechie-voice-seam/voice-pack';
import type {
	ProviderAdapterSeam,
	ProviderChatInput,
	ProviderChatOutput
} from '../../contracts/provider-adapter.contract';
import type { Result } from '../../contracts/shared.contract';

const studioInput = {
	actionId: 'generate',
	modeId: 'test',
	modeLabel: 'Test Mode',
	themeLabel: 'Test Theme',
	evidence: 'test evidence',
	voice: {
		intensity: 'receipts_out',
		rawness: 'mild',
		thirdPerson: 'sometimes'
	}
} as const;

const validStudioText = (overrides: Record<string, unknown> = {}): string =>
	JSON.stringify({
		verdict: 'Guilty',
		quote: 'No way',
		pageTitle: 'Uh oh',
		pageItems: [
			{ number: 1, label: 'One' },
			{ number: 2, label: 'Two' }
		],
		rating: 6,
		qualityState: 'ready',
		revisionNote: 'Enough to print.',
		...overrides
	});

const okChat = (
	content: string,
	model = 'test-model'
): Result<ProviderChatOutput> => ({
	ok: true,
	value: { model, content }
});

const providerError = (
	code: string,
	message: string,
	details?: Record<string, string>
): Result<ProviderChatOutput> => ({
	ok: false,
	error: { code, message, details }
});

const createDepsWithChatResults = (
	results: Array<Result<ProviderChatOutput>>,
	extras: Record<string, unknown> = {}
): { deps: MeechieStudioTextPipelineDeps; requests: ProviderChatInput[] } => {
	const requests: ProviderChatInput[] = [];
	let callIndex = 0;
	const provider: ProviderAdapterSeam = {
		createChatCompletion: async (input) => {
			requests.push(input);
			const result = results[Math.min(callIndex, results.length - 1)];
			callIndex++;
			return result;
		},
		createImageGeneration: async () => {
			throw new Error('not implemented');
		}
	};

	return {
		deps: {
			createProvider: () => provider,
			...extras
		} as unknown as MeechieStudioTextPipelineDeps,
		requests
	};
};

const lastUserMessage = (request: ProviderChatInput): string => {
	const message = request.messages[request.messages.length - 1];
	return message?.content ?? '';
};

describe('Meechie Studio Text Pipeline Resilience', () => {
	it('sends the pinned model and every owner-approved voice line in the structured request', async () => {
		const { deps, requests } = createDepsWithChatResults([
			okChat(validStudioText())
		]);

		const response = await runMeechieStudioTextPipeline(studioInput, deps);

		expect(response.status).toBe(200);
		expect(requests).toHaveLength(1);
		expect(requests[0].model).toBe(TEXT_MODEL);
		expect(requests[0].responseFormat).toMatchObject({ type: 'json_schema' });
		const systemPrompt = requests[0].messages[0].content;
		for (const quote of meechieVoicePack.responses.quotes) {
			expect(systemPrompt.split(`"${quote.text}"`).length - 1).toBe(1);
		}
	});

	it('handles valid JSON correctly', async () => {
		let callCount = 0;
		const deps: MeechieStudioTextPipelineDeps = {
			createProvider: () => ({
				createChatCompletion: async () => {
					callCount++;
					return {
						ok: true,
						value: {
							model: 'test-model',
							content: JSON.stringify({
								verdict: 'Guilty',
								quote: 'No way',
								pageTitle: 'Uh oh',
								pageItems: [
									{ number: 1, label: 'One' },
									{ number: 2, label: 'Two' }
								],
								qualityState: 'ready'
							})
						}
					};
				},
				createImageGeneration: async () => {
					throw new Error('not implemented');
				}
			})
		};

		const response = await runMeechieStudioTextPipeline(
			{
				actionId: 'generate',
				modeId: 'test',
				modeLabel: 'Test Mode',
				themeLabel: 'Test Theme',
				evidence: 'test evidence',
				voice: {
					intensity: 'receipts_out',
					rawness: 'mild',
					thirdPerson: 'sometimes'
				}
			},
			deps
		);

		expect(response.status).toBe(200);
		expect(response.body.ok).toBe(true);
		if (response.body.ok) {
			expect(response.body.value).toMatchObject({
				verdict: 'Guilty',
				quote: 'No way',
				pageTitle: 'Uh oh',
				pageItems: [
					{ number: 1, label: 'One' },
					{ number: 2, label: 'Two' }
				],
				qualityState: 'ready',
				modelMetadata: expect.objectContaining({
					model: 'test-model'
				})
			});
		}
		expect(callCount).toBe(1);
	});

	it('returns a browser-quiet structured error when the API key is missing', async () => {
		let callCount = 0;
		const deps: MeechieStudioTextPipelineDeps = {
			createProvider: () => ({
				createChatCompletion: async () => {
					callCount++;
					return {
						ok: false,
						error: {
							code: 'PROVIDER_API_KEY_MISSING',
							message: 'XAI_API_KEY is required.'
						}
					};
				},
				createImageGeneration: async () => {
					throw new Error('not implemented');
				}
			})
		};

		const response = await runMeechieStudioTextPipeline(
			{
				actionId: 'generate',
				modeId: 'test',
				modeLabel: 'Test Mode',
				themeLabel: 'Test Theme',
				evidence: 'test evidence',
				voice: {
					intensity: 'receipts_out',
					rawness: 'mild',
					thirdPerson: 'sometimes'
				}
			},
			deps
		);

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({
			ok: false,
			error: {
				code: 'PROVIDER_API_KEY_MISSING',
				message:
					'AI text generation requires XAI_API_KEY to be set on the server.'
			}
		});
		expect(callCount).toBe(1);
	});

	it('extracts JSON from markdown fences and prose', async () => {
		let callCount = 0;
		const deps: MeechieStudioTextPipelineDeps = {
			createProvider: () => ({
				createChatCompletion: async () => {
					callCount++;
					return {
						ok: true,
						value: {
							model: 'test-model',
							content: `Here is the result:
\`\`\`json
{
	"verdict": "Guilty",
	"quote": "No way",
	"pageTitle": "Uh oh",
	"pageItems": [{"number": 1, "label": "One"}, {"number": 2, "label": "Two"}],
	"qualityState": "ready"
}
\`\`\`
Hope that helps!`
						}
					};
				},
				createImageGeneration: async () => {
					throw new Error('not implemented');
				}
			})
		};

		const response = await runMeechieStudioTextPipeline(
			{
				actionId: 'generate',
				modeId: 'test',
				modeLabel: 'Test Mode',
				themeLabel: 'Test Theme',
				evidence: 'test evidence',
				voice: {
					intensity: 'receipts_out',
					rawness: 'mild',
					thirdPerson: 'sometimes'
				}
			},
			deps
		);

		expect(response.status).toBe(200);
		expect(callCount).toBe(1); // parsed on first try
	});

	it('extracts balanced JSON when prose contains extra braces', async () => {
		let callCount = 0;
		const deps: MeechieStudioTextPipelineDeps = {
			createProvider: () => ({
				createChatCompletion: async () => {
					callCount++;
					return {
						ok: true,
						value: {
							model: 'test-model',
							content: `Debug {not json} before payload.
{
	"verdict": "Guilty",
	"quote": "No way {still quoted}",
	"pageTitle": "Uh oh",
	"pageItems": [{"number": 1, "label": "One"}, {"number": 2, "label": "Two"}],
	"qualityState": "ready"
}
Trailing {also not json}.`
						}
					};
				},
				createImageGeneration: async () => {
					throw new Error('not implemented');
				}
			})
		};

		const response = await runMeechieStudioTextPipeline(
			{
				actionId: 'generate',
				modeId: 'test',
				modeLabel: 'Test Mode',
				themeLabel: 'Test Theme',
				evidence: 'test evidence',
				voice: {
					intensity: 'receipts_out',
					rawness: 'mild',
					thirdPerson: 'sometimes'
				}
			},
			deps
		);

		expect(response.status).toBe(200);
		expect(response.body.ok).toBe(true);
		if (response.body.ok) {
			expect(response.body.value.quote).toBe('No way {still quoted}');
		}
		expect(callCount).toBe(1);
	});

	it('retries once if JSON is malformed and fails gracefully', async () => {
		let callCount = 0;
		const deps: MeechieStudioTextPipelineDeps = {
			createProvider: () => ({
				createChatCompletion: async () => {
					callCount++;
					return {
						ok: true,
						value: {
							model: 'test-model',
							content: `Not JSON at all`
						}
					};
				},
				createImageGeneration: async () => {
					throw new Error('not implemented');
				}
			})
		};

		const response = await runMeechieStudioTextPipeline(
			{
				actionId: 'generate',
				modeId: 'test',
				modeLabel: 'Test Mode',
				themeLabel: 'Test Theme',
				evidence: 'test evidence',
				voice: {
					intensity: 'receipts_out',
					rawness: 'mild',
					thirdPerson: 'sometimes'
				}
			},
			deps
		);

		expect(response.status).toBe(502);
		expect(response.body).toMatchObject({
			ok: false,
			error: {
				code: 'MEECHIE_STUDIO_TEXT_PROVIDER_INVALID',
				details: {
					model: 'test-model',
					contentPreview: 'Not JSON at all'
				}
			}
		});
		expect(callCount).toBe(2); // Retried once
	});

	it('retries malformed JSON with a syntax-specific prompt and accepts the retry output', async () => {
		const { deps, requests } = createDepsWithChatResults([
			okChat('Not JSON at all'),
			okChat(validStudioText({ verdict: 'Retry Won' }))
		]);

		const response = await runMeechieStudioTextPipeline(studioInput, deps);

		expect(response.status).toBe(200);
		expect(response.body.ok).toBe(true);
		if (response.body.ok) {
			expect(response.body.value.verdict).toBe('Retry Won');
		}
		expect(requests).toHaveLength(2);
		expect(lastUserMessage(requests[1])).toContain('JSON syntax error');
		expect(lastUserMessage(requests[1])).toContain('ONLY a JSON object');
	});

	it('retries schema-invalid JSON with required-field guidance that matches the response format', async () => {
		const schemaInvalid = validStudioText({
			pageItems: [{ number: 1, label: 'Only one item' }]
		});
		const { deps, requests } = createDepsWithChatResults([
			okChat(schemaInvalid),
			okChat(validStudioText({ verdict: 'Schema Retry Won' }))
		]);

		const response = await runMeechieStudioTextPipeline(studioInput, deps);

		expect(response.status).toBe(200);
		expect(response.body.ok).toBe(true);
		expect(requests).toHaveLength(2);
		const retryPrompt = lastUserMessage(requests[1]);
		expect(retryPrompt).toContain('valid JSON but failed schema validation');
		expect(retryPrompt).toContain('rating (integer 1-10)');
		expect(retryPrompt).toContain('revisionNote (string)');
		expect(retryPrompt).not.toContain('Optional: rating');
	});

	it.each(['false', '0', '""', 'null'])(
		'treats valid JSON primitive %s as a schema failure before retrying',
		async (primitive) => {
			const { deps, requests } = createDepsWithChatResults([
				okChat(primitive),
				okChat(validStudioText())
			]);

			const response = await runMeechieStudioTextPipeline(studioInput, deps);

			expect(response.status).toBe(200);
			expect(response.body.ok).toBe(true);
			expect(requests).toHaveLength(2);
			expect(lastUserMessage(requests[1])).toContain(
				'valid JSON but failed schema validation'
			);
		}
	);

	it('uses injected runtime mode for missing API key status', async () => {
		const missingKey = providerError(
			'PROVIDER_API_KEY_MISSING',
			'XAI_API_KEY is required.'
		);
		const dev = createDepsWithChatResults([missingKey], {
			isProduction: false
		});
		const prod = createDepsWithChatResults([missingKey], {
			isProduction: true
		});

		const devResponse = await runMeechieStudioTextPipeline(
			studioInput,
			dev.deps
		);
		const prodResponse = await runMeechieStudioTextPipeline(
			studioInput,
			prod.deps
		);

		expect(devResponse.status).toBe(200);
		expect(prodResponse.status).toBe(502);
		expect(prodResponse.body).toMatchObject({
			ok: false,
			error: {
				code: 'PROVIDER_API_KEY_MISSING',
				message:
					'AI text generation requires XAI_API_KEY to be set on the server.'
			}
		});
	});

	it('preserves provider HTTP errors with a 502 status', async () => {
		const { deps } = createDepsWithChatResults([
			providerError('PROVIDER_HTTP_ERROR', 'Rate limited.', { status: '429' })
		]);

		const response = await runMeechieStudioTextPipeline(studioInput, deps);

		expect(response.status).toBe(502);
		expect(response.body).toMatchObject({
			ok: false,
			error: {
				code: 'PROVIDER_HTTP_ERROR',
				message: 'Rate limited.',
				details: { status: '429' }
			}
		});
	});

	it('maps timeout provider network errors to 504 and generic network errors to 502', async () => {
		const timeout = createDepsWithChatResults([
			providerError(
				'PROVIDER_NETWORK_ERROR',
				'Chat completion request timed out.'
			)
		]);
		const generic = createDepsWithChatResults([
			providerError('PROVIDER_NETWORK_ERROR', 'getaddrinfo ENOTFOUND api.x.ai')
		]);

		const timeoutResponse = await runMeechieStudioTextPipeline(
			studioInput,
			timeout.deps
		);
		const genericResponse = await runMeechieStudioTextPipeline(
			studioInput,
			generic.deps
		);

		expect(timeoutResponse.status).toBe(504);
		expect(genericResponse.status).toBe(502);
	});

	it('classifies provider errors returned during retry', async () => {
		const { deps } = createDepsWithChatResults([
			okChat('not json'),
			providerError(
				'PROVIDER_NETWORK_ERROR',
				'Chat completion request timed out.'
			)
		]);

		const response = await runMeechieStudioTextPipeline(studioInput, deps);

		expect(response.status).toBe(504);
		expect(response.body).toMatchObject({
			ok: false,
			error: {
				code: 'PROVIDER_NETWORK_ERROR',
				message: 'Chat completion request timed out.'
			}
		});
	});

	it('rejects input containing a disallowed keyword and does not call the provider', async () => {
		let callCount = 0;
		const deps: MeechieStudioTextPipelineDeps = {
			createProvider: () => ({
				createChatCompletion: async () => {
					callCount++;
					return {
						ok: true,
						value: {
							model: 'test-model',
							content: JSON.stringify({
								verdict: 'should not reach',
								quote: 'n/a',
								pageTitle: 'n/a',
								pageItems: [{ number: 1, label: 'n/a' }],
								qualityState: 'ready'
							})
						}
					};
				},
				createImageGeneration: async () => {
					throw new Error('not implemented');
				}
			})
		};

		// 'minors' is in SYSTEM_CONSTANTS.DISALLOWED_KEYWORDS
		const response = await runMeechieStudioTextPipeline(
			{
				actionId: 'generate',
				modeId: 'test',
				modeLabel: 'Test Mode',
				themeLabel: 'Test Theme',
				evidence: 'evidence mentioning minors in coloring books',
				voice: {
					intensity: 'receipts_out',
					rawness: 'mild',
					thirdPerson: 'sometimes'
				}
			},
			deps
		);

		expect(response.status).toBe(400);
		expect(response.body).toMatchObject({
			ok: false,
			error: {
				code: 'DISALLOWED_CONTENT'
			}
		});
		// Provider MUST NOT have been called
		expect(callCount).toBe(0);
	});
});
