// Purpose: Contract tests for ImageGenerationSeam mock behavior.
// Why: Enforce deterministic fixture-backed sample and fault outputs.
// Info flow: tests -> mock -> validators/assertions.
import { describe, expect, it } from 'vitest';
import { createMockImageGenerationSeam } from './mock';
import {
getImageGenerationFixture,
imageGenerationFaultFixture,
imageGenerationSampleFixture
} from './fixtures';
import {
validateImageGenerationRequest,
validateImageGenerationResult
} from './validators';

describe('ImageGenerationSeam mock contract', () => {
it('returns sample fixture output for sample scenario', async () => {
const seam = createMockImageGenerationSeam('sample');
const request = validateImageGenerationRequest(imageGenerationSampleFixture.input);
const result = await seam.generate(request);

expect(result).toEqual(imageGenerationSampleFixture.output);
expect(validateImageGenerationResult(result)).toEqual(imageGenerationSampleFixture.output);
});

it('returns fault fixture output for fault scenario', async () => {
const seam = createMockImageGenerationSeam('fault');
const request = validateImageGenerationRequest(getImageGenerationFixture('fault').input);
const result = await seam.generate(request);

expect(result).toEqual(imageGenerationFaultFixture.output);
expect(validateImageGenerationResult(result)).toEqual(imageGenerationFaultFixture.output);
if (!result.ok) {
expect(result.error.code).toBe('PROMPT_MISSING_REQUIRED_PHRASES');
}
});
});
