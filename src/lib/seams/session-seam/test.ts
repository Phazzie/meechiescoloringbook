/*
 * Purpose: Contract and unit verification for SessionSeam.
 * Why: Ensure SessionSeam contract invariants hold across scenarios.
 * Info flow: Fixtures -> Mock/Contract -> Vitest assertions.
 * Invariants: Sample returns ok: true with non-empty sessionId; fault returns BROWSER_REQUIRED.
 */
import { describe, expect, it } from 'vitest';
import { SessionContextSchema } from './contract';
import { sessionSampleFixture, sessionFaultFixture } from './fixtures';
import { createSessionMock } from './mock';

describe('SessionSeam contract (self-contained)', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createSessionMock('sample');
		const output = await mock.getSession();
		expect(output).toEqual(sessionSampleFixture.output);
		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.sessionId).toBe('session-123');
		}
	});

	it('mock returns fault fixture output', async () => {
		const mock = createSessionMock('fault');
		const output = await mock.getSession();
		expect(output).toEqual(sessionFaultFixture.output);
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('BROWSER_REQUIRED');
			expect(output.error.message).toBe('Session access requires a browser environment.');
		}
	});

	it('validates non-empty sessionId schema constraints', () => {
		const validResult = SessionContextSchema.safeParse({ sessionId: 'session-valid-999' });
		expect(validResult.success).toBe(true);

		const emptyResult = SessionContextSchema.safeParse({ sessionId: '' });
		expect(emptyResult.success).toBe(false);

		const whitespaceResult = SessionContextSchema.safeParse({ sessionId: '   ' });
		expect(whitespaceResult.success).toBe(false);
	});
});
