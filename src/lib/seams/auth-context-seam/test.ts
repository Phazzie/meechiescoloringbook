// Purpose: Contract tests for AuthContextSeam using fixture-backed mocks.
// Why: Ensure auth context outputs are deterministic and validated.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AuthContextInputSchema, AuthContextResultSchema } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import { createAuthContextMock } from './mock';
import { authContextAdapter } from '../../adapters/auth-context-seam';
import { authContextSampleFixture, authContextFaultFixture } from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: AuthContextInputSchema,
	output: AuthContextResultSchema
});

const sampleFixture = fixtureSchema.parse(authContextSampleFixture);
const faultFixture = fixtureSchema.parse(authContextFaultFixture);

describe('AuthContextSeam contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createAuthContextMock('sample');
		const output = await mock.getAuthContext(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createAuthContextMock('fault');
		const output = await mock.getAuthContext(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter returns sample fixture output', async () => {
		const output = await authContextAdapter.getAuthContext(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('adapter returns fault fixture output', async () => {
		const output = await authContextAdapter.getAuthContext(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});
});

describe('AuthContextSeam adapter edge cases', () => {
	it('adapter returns anonymous context when sessionId is absent', async () => {
		const output = await authContextAdapter.getAuthContext({});
		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.kind).toBe('anonymous');
			expect(output.value.capabilities).toContain('generate');
			expect(output.value.capabilities).toContain('store');
		}
	});

	it('adapter returns anonymous context for an empty string sessionId (treated as absent)', async () => {
		// Empty string is falsy — the guard skips validation, so the adapter treats it as no sessionId.
		const output = await authContextAdapter.getAuthContext({ sessionId: '' });
		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.kind).toBe('anonymous');
		}
	});

	it('adapter returns SESSION_ID_INVALID for a sessionId containing spaces', async () => {
		const output = await authContextAdapter.getAuthContext({ sessionId: 'invalid id with spaces' });
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('SESSION_ID_INVALID');
		}
	});

	it('adapter returns SESSION_ID_INVALID for a sessionId containing a forward slash', async () => {
		const output = await authContextAdapter.getAuthContext({ sessionId: 'invalid/id' });
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('SESSION_ID_INVALID');
		}
	});

	it('adapter returns SESSION_ID_INVALID for a sessionId with special chars (@, #)', async () => {
		const output = await authContextAdapter.getAuthContext({ sessionId: 'user@domain#42' });
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('SESSION_ID_INVALID');
		}
	});

	it('adapter accepts a sessionId consisting only of alphanumerics, hyphens, and underscores', async () => {
		const output = await authContextAdapter.getAuthContext({ sessionId: 'anon-session_123' });
		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.rateLimitTier).toBe('anonymous');
		}
	});
});
