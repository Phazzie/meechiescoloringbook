// Purpose: Unit tests for the parseRequestBody utility.
// Why: Verify SyntaxError → INVALID_JSON, and non-SyntaxError errors propagate as-is.
// Info flow: Mock Request -> parseRequestBody -> ParseResult or thrown error.
import { describe, expect, it } from 'vitest';
import { parseRequestBody } from '../../src/lib/server/parse-request-body';

const makeRequest = (body: string) =>
	new Request('http://localhost/test', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body
	});

describe('parseRequestBody', () => {
	it('returns ok with parsed body for valid JSON', async () => {
		const result = await parseRequestBody(makeRequest('{"foo":"bar"}'));
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.body).toEqual({ foo: 'bar' });
	});

	it('returns INVALID_JSON failure for malformed JSON (SyntaxError)', async () => {
		const result = await parseRequestBody(makeRequest('{not: valid}'));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			const payload = await result.response.json();
			expect(result.response.status).toBe(400);
			expect(payload.error.code).toBe('INVALID_JSON');
		}
	});

	it('propagates non-SyntaxError errors rather than converting them to 400', async () => {
		const badRequest = {
			json: async () => {
				throw new TypeError('body already consumed');
			}
		} as unknown as Request;

		await expect(parseRequestBody(badRequest)).rejects.toThrow(TypeError);
	});
});
