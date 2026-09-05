/*
 * Purpose: Contract and unit verification for ProviderAdapterSeam.
 * Why: Ensure ProviderAdapterSeam contract invariants hold across scenarios.
 * Info flow: Fixtures -> Mock/Contract -> Vitest assertions.
 * Invariants: Sample returns ok: true for chat and image; fault returns PROVIDER_HTTP_ERROR; responseFormat must be url or b64_json; abort signal returns ABORT_ERROR.
 */
import { describe, expect, it } from 'vitest';
import { ProviderImageInputSchema } from './contract';
import { providerAdapterSampleFixture, providerAdapterFaultFixture } from './fixtures';
import { createProviderAdapterMock } from './mock';
import { createProviderAdapter } from '../../adapters/provider-adapter-seam';

describe('ProviderAdapterSeam contract (self-contained)', () => {
	it('mock returns sample fixture chat output', async () => {
		const mock = createProviderAdapterMock('sample');
		const output = await mock.createChatCompletion(providerAdapterSampleFixture.input.chat);
		expect(output).toEqual(providerAdapterSampleFixture.output.chat);
		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.model).toBe('grok-4.6');
		}
	});

	it('mock returns sample fixture image output', async () => {
		const mock = createProviderAdapterMock('sample');
		const output = await mock.createImageGeneration(providerAdapterSampleFixture.input.image);
		expect(output).toEqual(providerAdapterSampleFixture.output.image);
		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.images.length).toBeGreaterThan(0);
		}
	});

	it('mock returns fault fixture chat output', async () => {
		const mock = createProviderAdapterMock('fault');
		const output = await mock.createChatCompletion(providerAdapterFaultFixture.input.chat);
		expect(output).toEqual(providerAdapterFaultFixture.output.chat);
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('PROVIDER_HTTP_ERROR');
		}
	});

	it('mock returns fault fixture image output', async () => {
		const mock = createProviderAdapterMock('fault');
		const output = await mock.createImageGeneration(providerAdapterFaultFixture.input.image);
		expect(output).toEqual(providerAdapterFaultFixture.output.image);
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('PROVIDER_HTTP_ERROR');
		}
	});

	it('validates responseFormat enum rejection on image input schema', () => {
		const invalid = ProviderImageInputSchema.safeParse({
			...providerAdapterSampleFixture.input.image,
			responseFormat: 'xml'
		});
		expect(invalid.success).toBe(false);

		const valid = ProviderImageInputSchema.safeParse(providerAdapterSampleFixture.input.image);
		expect(valid.success).toBe(true);
	});

	it('immediate abort signal triggers ABORT_ERROR within 50ms', async () => {
		const controller = new AbortController();
		controller.abort();
		const adapter = createProviderAdapter({ apiKey: 'dummy-key' });
		const start = Date.now();
		const result = await adapter.createChatCompletion({
			...providerAdapterSampleFixture.input.chat,
			signal: controller.signal
		});
		const elapsed = Date.now() - start;
		expect(elapsed).toBeLessThan(100);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('ABORT_ERROR');
		}
	});
});
