/*
 * Purpose: Unit tests for startup environment variable classification.
 * Why: Prove required-vs-optional env vars are detected before request-time failures.
 * Info flow: raw env record -> checkStartupEnv -> missingRequired/missingOptional lists.
 */
import { describe, expect, it } from 'vitest';

import { checkStartupEnv } from '../../src/lib/core/startup-env-check';

const ALL_REQUIRED_KEYS = [
	'XAI_API_KEY',
	'XAI_TEXT_MODEL',
	'XAI_IMAGE_MODEL',
	'XAI_BASE_URL',
	'XAI_IMAGE_ENDPOINT_PATH',
	'DEFAULT_IMAGE_SIZE'
];

const FULLY_SET_ENV = {
	XAI_API_KEY: 'sk-real-key',
	XAI_TEXT_MODEL: 'grok-4-1-fast-reasoning',
	XAI_IMAGE_MODEL: 'grok-imagine-image',
	XAI_BASE_URL: 'https://api.x.ai',
	XAI_IMAGE_ENDPOINT_PATH: '/v1/images/generations',
	DEFAULT_IMAGE_SIZE: '1024x1024'
};

describe('checkStartupEnv', () => {
	it('reports every AppConfigSeam-required var as missing required when absent', () => {
		const result = checkStartupEnv({});
		expect(result.missingRequired.map((envVar) => envVar.key)).toEqual(ALL_REQUIRED_KEYS);
	});

	it('treats a blank XAI_API_KEY the same as an absent one', () => {
		const result = checkStartupEnv({ ...FULLY_SET_ENV, XAI_API_KEY: '   ' });
		expect(result.missingRequired.map((envVar) => envVar.key)).toEqual(['XAI_API_KEY']);
	});

	it('does not flag any required var when all are set', () => {
		const result = checkStartupEnv(FULLY_SET_ENV);
		expect(result.missingRequired).toEqual([]);
	});

	it('reports GEMINI_API_KEY as missing optional when absent', () => {
		const result = checkStartupEnv(FULLY_SET_ENV);
		expect(result.missingOptional.map((envVar) => envVar.key)).toEqual(['GEMINI_API_KEY']);
	});

	it('clears optional vars once they are set', () => {
		const result = checkStartupEnv({ ...FULLY_SET_ENV, GEMINI_API_KEY: 'gemini-key' });
		expect(result.missingRequired).toEqual([]);
		expect(result.missingOptional).toEqual([]);
	});
});
