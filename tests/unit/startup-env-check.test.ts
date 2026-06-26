/*
 * Purpose: Unit tests for startup environment variable classification.
 * Why: Prove required-vs-optional env vars are detected before request-time failures.
 * Info flow: raw env record -> checkStartupEnv -> missingRequired/missingOptional lists.
 */
import { describe, expect, it } from 'vitest';

import { checkStartupEnv } from '../../src/lib/core/startup-env-check';

describe('checkStartupEnv', () => {
	it('reports XAI_API_KEY as missing required when absent', () => {
		const result = checkStartupEnv({});
		expect(result.missingRequired.map((envVar) => envVar.key)).toEqual(['XAI_API_KEY']);
	});

	it('treats a blank XAI_API_KEY the same as an absent one', () => {
		const result = checkStartupEnv({ XAI_API_KEY: '   ' });
		expect(result.missingRequired.map((envVar) => envVar.key)).toEqual(['XAI_API_KEY']);
	});

	it('does not flag XAI_API_KEY when it is set', () => {
		const result = checkStartupEnv({ XAI_API_KEY: 'sk-real-key' });
		expect(result.missingRequired).toEqual([]);
	});

	it('reports GEMINI_API_KEY and XAI_TEXT_MODEL as missing optional when absent', () => {
		const result = checkStartupEnv({ XAI_API_KEY: 'sk-real-key' });
		expect(result.missingOptional.map((envVar) => envVar.key)).toEqual([
			'GEMINI_API_KEY',
			'XAI_TEXT_MODEL'
		]);
	});

	it('clears optional vars once they are set', () => {
		const result = checkStartupEnv({
			XAI_API_KEY: 'sk-real-key',
			GEMINI_API_KEY: 'gemini-key',
			XAI_TEXT_MODEL: 'grok-4-1-fast-reasoning'
		});
		expect(result.missingRequired).toEqual([]);
		expect(result.missingOptional).toEqual([]);
	});
});
