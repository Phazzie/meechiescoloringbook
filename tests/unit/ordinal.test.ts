// Purpose: Unit tests for ordinal suffix formatting.
// Why: Keep lineup position labels correct across adapter layouts.
// Info flow: numeric position -> formatter -> display label.
import { describe, expect, it } from 'vitest';
import { formatOrdinal } from '../../src/lib/core/ordinal';

describe('formatOrdinal', () => {
	it('formats common ordinal suffixes', () => {
		expect(formatOrdinal(1)).toBe('1st');
		expect(formatOrdinal(2)).toBe('2nd');
		expect(formatOrdinal(3)).toBe('3rd');
		expect(formatOrdinal(4)).toBe('4th');
	});

	it('keeps 11 through 13 as th suffixes', () => {
		expect(formatOrdinal(11)).toBe('11th');
		expect(formatOrdinal(12)).toBe('12th');
		expect(formatOrdinal(13)).toBe('13th');
		expect(formatOrdinal(111)).toBe('111th');
		expect(formatOrdinal(112)).toBe('112th');
		expect(formatOrdinal(113)).toBe('113th');
	});

	it('formats twenties and higher suffixes by the final digit outside teen exceptions', () => {
		expect(formatOrdinal(21)).toBe('21st');
		expect(formatOrdinal(22)).toBe('22nd');
		expect(formatOrdinal(23)).toBe('23rd');
		expect(formatOrdinal(101)).toBe('101st');
		expect(formatOrdinal(102)).toBe('102nd');
		expect(formatOrdinal(103)).toBe('103rd');
	});
});
