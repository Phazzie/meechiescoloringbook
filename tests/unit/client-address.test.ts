// Purpose: Unit tests for the safeClientAddress helper.
// Why: Prove getClientAddress() failures fall back to a shared key instead of crashing callers.
// Info flow: getClientAddress function -> safeClientAddress -> string (never throws).
import { describe, expect, it } from 'vitest';
import { safeClientAddress } from '../../src/lib/server/client-address';

describe('safeClientAddress', () => {
	it('returns the resolved client address when getClientAddress succeeds', () => {
		expect(safeClientAddress(() => '203.0.113.5')).toBe('203.0.113.5');
	});

	it('falls back to "unknown" instead of throwing when getClientAddress throws', () => {
		const throwing = () => {
			throw new Error('client address not available');
		};
		expect(safeClientAddress(throwing)).toBe('unknown');
	});
});
