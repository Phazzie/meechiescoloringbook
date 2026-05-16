/*
 * Purpose: Unit tests for centralized text model selection.
 * Why: Prevent whitespace-padded provider model configuration from leaking into requests.
 * Info flow: configured model string -> selectTextModel -> normalized model id.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_TEXT_MODEL, selectTextModel } from '../../src/lib/core/text-model';

describe('selectTextModel', () => {
	it('returns the default model when no configured model is supplied', () => {
		expect(selectTextModel(undefined)).toBe(DEFAULT_TEXT_MODEL);
	});

	it('returns the default model when the configured model is blank', () => {
		expect(selectTextModel('   ')).toBe(DEFAULT_TEXT_MODEL);
	});

	it('trims a configured model before returning it', () => {
		expect(selectTextModel('  grok-custom-model  ')).toBe('grok-custom-model');
	});
});
