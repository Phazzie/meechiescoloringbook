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
								pageItems: [{ number: 1, label: 'One' }, { number: 2, label: 'Two' }],
								qualityState: 'ready'
							})
						}
					};
				},
				createImageGeneration: async () => { throw new Error('not implemented'); }
			})
		};

		const response = await runMeechieStudioTextPipeline({
			actionId: 'generate',
			modeId: 'test',
			modeLabel: 'Test Mode',
			themeLabel: 'Test Theme',
			evidence: 'test evidence',
			voice: { intensity: 'receipts_out', rawness: 'mild', thirdPerson: 'sometimes' }
		}, deps);

		expect(response.status).toBe(200);
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
				createImageGeneration: async () => { throw new Error('not implemented'); }
			})
		};

		const response = await runMeechieStudioTextPipeline({
			actionId: 'generate',
			modeId: 'test',
			modeLabel: 'Test Mode',
			themeLabel: 'Test Theme',
			evidence: 'test evidence',
			voice: { intensity: 'receipts_out', rawness: 'mild', thirdPerson: 'sometimes' }
		}, deps);

		expect(response.status).toBe(200);
		expect(callCount).toBe(1); // parsed on first try
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
				createImageGeneration: async () => { throw new Error('not implemented'); }
			})
		};

		const response = await runMeechieStudioTextPipeline({
			actionId: 'generate',
			modeId: 'test',
			modeLabel: 'Test Mode',
			themeLabel: 'Test Theme',
			evidence: 'test evidence',
			voice: { intensity: 'receipts_out', rawness: 'mild', thirdPerson: 'sometimes' }
		}, deps);

		expect(response.status).toBe(502);
		expect(callCount).toBe(2); // Retried once
	});
});
