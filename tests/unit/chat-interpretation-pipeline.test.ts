// Purpose: Unit tests for runChatInterpretationPipeline's internal abort guard.
// Why: Defense-in-depth — the route already checks checkChatInterpretationAbort before
// calling in, but the pipeline must also fail fast for any other caller that skips that
// preflight.
// Info flow: Pipeline body+deps -> abort guard -> aborted response (no provider/validate calls).
import { describe, expect, it, vi } from 'vitest';
import { runChatInterpretationPipeline } from '../../src/lib/core/chat-interpretation-pipeline';

describe('runChatInterpretationPipeline abort guard', () => {
	it('returns CHAT_ABORTED before any provider call or spec validation when the signal is already aborted', async () => {
		const controller = new AbortController();
		controller.abort();
		const createChatCompletion = vi.fn();
		const validateSpec = vi.fn();

		const result = await runChatInterpretationPipeline(
			{ message: 'build me a page' },
			{ createChatCompletion, validateSpec, signal: controller.signal }
		);

		expect(result.status).toBe(499);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('CHAT_ABORTED');
		}
		expect(createChatCompletion).not.toHaveBeenCalled();
		expect(validateSpec).not.toHaveBeenCalled();
	});
});
