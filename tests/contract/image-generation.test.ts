// Purpose: Contract tests for ImageGenerationSeam using fixture-backed mocks.
// Why: Ensure xAI-backed image generation returns contract-compliant results.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
	ImageGenerationInputSchema,
	ImageGenerationResultSchema
} from '../../contracts/image-generation.contract';
import { ScenarioSchema } from '../../contracts/shared.contract';
import { createImageGenerationMock } from '../../src/lib/mocks/image-generation.mock';
import { imageGenerationAdapter } from '../../src/lib/adapters/image-generation.adapter';
import sample from '../../fixtures/image-generation/sample.json';
import fault from '../../fixtures/image-generation/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: ImageGenerationInputSchema,
	output: ImageGenerationResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn(async () => {
		return new Response(JSON.stringify(sampleFixture.output), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	});
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('ImageGenerationSeam contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createImageGenerationMock('sample');
		const output = await mock.generate(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createImageGenerationMock('fault');
		const output = await mock.generate(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter returns sample fixture output', async () => {
		const output = await imageGenerationAdapter.generate(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('adapter returns error for invalid prompt', async () => {
		const output = await imageGenerationAdapter.generate(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
