// Purpose: Centralize browser JSON request helpers for client routes.
// Why: Remove duplicated fetch/header logic between builder and Meechie tools.
// Info flow: UI state -> shared helper -> API request/response payload.

export const buildJsonHeaders = (): Record<string, string> => ({
	'Content-Type': 'application/json'
});

export const postJson = async (url: string, body: unknown): Promise<unknown> => {
	const response = await fetch(url, {
		method: 'POST',
		headers: buildJsonHeaders(),
		body: JSON.stringify(body)
	});
	return response.json().catch(() => {
		throw new Error('postJson: failed to parse JSON response');
	});
};
