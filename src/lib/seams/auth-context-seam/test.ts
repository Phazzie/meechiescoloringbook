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
