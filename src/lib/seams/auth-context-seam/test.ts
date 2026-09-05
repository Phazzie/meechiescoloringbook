/*
 * Purpose: Contract and unit verification for AuthContextSeam.
 * Why: Ensure AuthContextSeam contract invariants hold across scenarios.
 * Info flow: Fixtures -> Mock/Contract -> Vitest assertions.
 * Invariants: Authenticated kind requires non-empty userId; fault scenario returns SESSION_ID_INVALID.
 */
import { describe, expect, it } from 'vitest';
import { AuthContextSchema } from './contract';
import { authContextSampleFixture, authContextFaultFixture } from './fixtures';
import { createAuthContextMock } from './mock';

describe('AuthContextSeam contract (self-contained)', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createAuthContextMock('sample');
		const output = await mock.getAuthContext({ sessionId: 'session-123' });
		expect(output).toEqual(authContextSampleFixture.output);
		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.kind).toBe('anonymous');
			expect(output.value.rateLimitTier).toBe('anonymous');
		}
	});

	it('mock returns fault fixture output', async () => {
		const mock = createAuthContextMock('fault');
		const output = await mock.getAuthContext({ sessionId: 'bad id' });
		expect(output).toEqual(authContextFaultFixture.output);
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('SESSION_ID_INVALID');
			expect(output.error.message).toBe('Session ID contains invalid characters.');
		}
	});

	it('validates anonymous auth context without userId', () => {
		const anonymousResult = AuthContextSchema.safeParse({
			kind: 'anonymous',
			capabilities: ['generate', 'store'],
			rateLimitTier: 'anonymous'
		});
		expect(anonymousResult.success).toBe(true);
	});

	it('validates authenticated auth context with non-empty userId', () => {
		const authenticatedResult = AuthContextSchema.safeParse({
			kind: 'authenticated',
			userId: 'user_12345',
			capabilities: ['generate', 'store'],
			rateLimitTier: 'subscriber'
		});
		expect(authenticatedResult.success).toBe(true);
	});

	it('rejects authenticated auth context with missing or empty userId', () => {
		const missingUserResult = AuthContextSchema.safeParse({
			kind: 'authenticated',
			capabilities: ['generate', 'store'],
			rateLimitTier: 'subscriber'
		});
		expect(missingUserResult.success).toBe(false);

		const emptyUserResult = AuthContextSchema.safeParse({
			kind: 'authenticated',
			userId: '',
			capabilities: ['generate', 'store'],
			rateLimitTier: 'subscriber'
		});
		expect(emptyUserResult.success).toBe(false);

		const whitespaceUserResult = AuthContextSchema.safeParse({
			kind: 'authenticated',
			userId: '   ',
			capabilities: ['generate', 'store'],
			rateLimitTier: 'subscriber'
		});
		expect(whitespaceUserResult.success).toBe(false);
	});
});
