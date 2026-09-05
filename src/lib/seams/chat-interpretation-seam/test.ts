/*
 * Purpose: Contract and unit verification for ChatInterpretationSeam.
 * Why: Ensure ChatInterpretationSeam contract invariants hold across scenarios.
 * Info flow: Fixtures -> Mock/Contract -> Vitest assertions.
 * Invariants: Sample returns ok: true with valid spec; fault returns CHAT_RESPONSE_INVALID; empty message fails input schema.
 */
import { describe, expect, it } from 'vitest';
import { ChatInterpretationInputSchema } from './contract';
import { chatInterpretationSampleFixture, chatInterpretationFaultFixture } from './fixtures';
import { createChatInterpretationMock } from './mock';

describe('ChatInterpretationSeam contract (self-contained)', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createChatInterpretationMock('sample');
		const output = await mock.interpret(chatInterpretationSampleFixture.input);
		expect(output).toEqual(chatInterpretationSampleFixture.output);
		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.spec.title).toBe('Growth Checklist');
			expect(output.value.spec.items).toHaveLength(2);
		}
	});

	it('mock returns fault fixture output', async () => {
		const mock = createChatInterpretationMock('fault');
		const output = await mock.interpret(chatInterpretationFaultFixture.input);
		expect(output).toEqual(chatInterpretationFaultFixture.output);
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('CHAT_RESPONSE_INVALID');
			expect(output.error.message).toBe('Chat interpretation response did not match contract.');
		}
	});

	it('validates schema constraints on input message', () => {
		const valid = ChatInterpretationInputSchema.safeParse({ message: 'Generate a cat' });
		expect(valid.success).toBe(true);

		const empty = ChatInterpretationInputSchema.safeParse({ message: '' });
		expect(empty.success).toBe(false);

		const nonString = ChatInterpretationInputSchema.safeParse({ message: 123 });
		expect(nonString.success).toBe(false);
	});
});
