/*
 * Purpose: Unit tests for runMeechieStudioTextPipeline.
 * Why: Ensure the pipeline rejects invalid input, disallowed content, and handles provider errors.
 * Info flow: Test inputs -> runMeechieStudioTextPipeline -> assertions.
 */
import { describe, expect, it } from 'vitest';
import { runMeechieStudioTextPipeline } from '../../src/lib/core/meechie-studio-text-pipeline';
import type { MeechieStudioTextPipelineDeps } from '../../src/lib/core/meechie-studio-text-pipeline';

describe('Meechie Studio Text Pipeline Resilience', () => {
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
				code: 'MEECHIE_STUDIO_TEXT_PROVIDER_INVALID'
			}
		});
		expect(callCount).toBe(2); // Retried once
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
