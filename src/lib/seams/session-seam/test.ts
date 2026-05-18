// Purpose: Contract tests for SessionSeam using fixture-backed mocks.
// Why: Ensure session behavior is deterministic and environment-gated.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SessionResultSchema } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import { createSessionMock } from './mock';
import { sessionAdapter } from '../../adapters/session-seam';
import { sessionSampleFixture, sessionFaultFixture } from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: z.object({}).strict(),
	output: SessionResultSchema
});

const sampleFixture = fixtureSchema.parse(sessionSampleFixture);
const faultFixture = fixtureSchema.parse(sessionFaultFixture);

describe('SessionSeam contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createSessionMock('sample');
		const output = await mock.getSession();
		expect(output).toEqual(sampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createSessionMock('fault');
		const output = await mock.getSession();
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter returns browser-gated result', async () => {
		const output = await sessionAdapter.getSession();
		if (typeof localStorage === 'undefined') {
			expect(output).toEqual(faultFixture.output);
		} else {
			expect(output.ok).toBe(true);
			if (output.ok) {
				expect(output.value.sessionId.length).toBeGreaterThan(0);
			}
		}
	});
});
