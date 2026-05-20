// Purpose: Contract tests for WigTryOnSeam.
// Why: Enforce mock adherence to the seam contract and prove fault fixtures fail before mocking.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import {
	wigTryOnRequestFixture,
	wigTryOnHttpErrorFixture,
	wigTryOnConfigErrorFixture
} from './fixtures';
import { createMockWigTryOnSeam } from './mock';
import { validateWigTryOnRequest, validateWigTryOnResult } from './validators';

describe('WigTryOnSeam mock contract', () => {
	it('tryOn returns a portrait Result on success', async () => {
		const seam = createMockWigTryOnSeam('sample');
		const request = validateWigTryOnRequest(wigTryOnRequestFixture);
		const result = await seam.tryOn(request);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.portraitBase64.length).toBeGreaterThan(0);
		expect(() => validateWigTryOnResult(result.value)).not.toThrow();
	});

	it('http_error scenario returns WIG_TRY_ON_HTTP_ERROR', async () => {
		const seam = createMockWigTryOnSeam('http_error');
		const request = validateWigTryOnRequest(wigTryOnRequestFixture);
		const result = await seam.tryOn(request);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe(wigTryOnHttpErrorFixture.code);
	});

	it('config_error scenario returns WIG_TRY_ON_CONFIG_ERROR', async () => {
		const seam = createMockWigTryOnSeam('config_error');
		const request = validateWigTryOnRequest(wigTryOnRequestFixture);
		const result = await seam.tryOn(request);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe(wigTryOnConfigErrorFixture.code);
	});

	it('portrait base64 is a non-empty string', async () => {
		const seam = createMockWigTryOnSeam('sample');
		const result = await seam.tryOn(wigTryOnRequestFixture);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(typeof result.value.portraitBase64).toBe('string');
		expect(result.value.portraitBase64.length).toBeGreaterThan(0);
	});
});
