// Purpose: Centralize server-side request body parsing with structured error responses.
// Why: All API routes previously swallowed JSON parse errors silently via .catch(() => null),
//      making it impossible for clients to distinguish malformed JSON from schema validation failures.
// Info flow: Request -> JSON parse attempt -> ParseResult (ok or INVALID_JSON response).
import { json } from '@sveltejs/kit';

export type ParseSuccess = { ok: true; body: unknown };
export type ParseFailure = { ok: false; response: Response };
export type ParseResult = ParseSuccess | ParseFailure;

export const parseRequestBody = async (request: Request): Promise<ParseResult> => {
	try {
		const body = await request.json();
		return { ok: true, body };
	} catch {
		return {
			ok: false,
			response: json(
				{ ok: false, error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } },
				{ status: 400 }
			)
		};
	}
};
