// Purpose: Verify /api/meechie-studio-text input validation and malformed JSON guard.
// Why: Ensure the route returns 400 REQUEST_BODY_INVALID before calling the pipeline.
// Info flow: Request payload -> endpoint -> pipeline or 400 short-circuit.
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/adapters/provider-adapter.adapter', () => ({
	createProviderAdapter: vi.fn()
}));

import { createProviderAdapter } from '../../src/lib/adapters/provider-adapter.adapter';
import { POST } from '../../src/routes/api/meechie-studio-text/+server';

const mockCreateProviderAdapter = vi.mocked(createProviderAdapter);

const buildRawEvent = (rawBody: string) =>
	({
		request: new Request('http://localhost/api/meechie-studio-text', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		})
	}) as Parameters<typeof POST>[0];

describe('/api/meechie-studio-text', () => {
	beforeEach(() => {
		mockCreateProviderAdapter.mockReset();
	});

	it('returns 400 for malformed JSON body without calling provider', async () => {
		const response = await POST(buildRawEvent('not valid json'));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('REQUEST_BODY_INVALID');
		expect(mockCreateProviderAdapter).not.toHaveBeenCalled();
	});
});
