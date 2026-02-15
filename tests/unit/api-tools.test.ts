// Purpose: Verify /api/tools endpoint validation and safety behavior.
// Why: Keep Meechie tool requests contract-safe and blocked on disallowed content.
// Info flow: Request payload -> endpoint -> safety + adapter result.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../src/routes/api/tools/+server';
import { meechieToolAdapter } from '../../src/lib/adapters/meechie-tool.adapter';

const buildEvent = (body: unknown): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/tools', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	}) as Parameters<typeof POST>[0];

afterEach(() => {
	vi.restoreAllMocks();
});

describe('/api/tools', () => {
	it('rejects disallowed content and does not invoke adapter', async () => {
		const adapterSpy = vi.spyOn(meechieToolAdapter, 'respond');
		const response = await POST(
			buildEvent({
				toolId: 'apology_translator',
				apology: 'This is explicit content.'
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('DISALLOWED_CONTENT');
		expect(adapterSpy).not.toHaveBeenCalled();
	});

	it('returns adapter output for valid input', async () => {
		vi.spyOn(meechieToolAdapter, 'respond').mockResolvedValue({
			ok: true,
			value: {
				toolId: 'apology_translator',
				headline: 'Decoded',
				response: 'That apology was weak.'
			}
		});

		const response = await POST(
			buildEvent({
				toolId: 'apology_translator',
				apology: "I'm sorry you feel that way."
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			ok: true,
			value: {
				toolId: 'apology_translator',
				headline: 'Decoded',
				response: 'That apology was weak.'
			}
		});
	});
});
