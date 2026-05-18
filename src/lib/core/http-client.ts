// Purpose: Centralize browser JSON request helpers for client routes.
// Why: Remove duplicated fetch/header logic between builder and Meechie tools.
// Info flow: UI state -> shared helper -> API request/response payload.

export const buildJsonHeaders = (): Record<string, string> => ({
	'Content-Type': 'application/json'
});

export const postJson = async (url: string, body: unknown): Promise<{ payload: unknown }> => {
	const response = await fetch(url, {
		method: 'POST',
		headers: buildJsonHeaders(),
		body: JSON.stringify(body)
	});
	const payload = await response.json().catch(() => {
		// JSON parse failed — if status is also bad, surface the HTTP error.
		if (!response.ok) {
			throw new Error(`postJson: HTTP ${response.status} ${response.statusText}`);
		}
		throw new Error('postJson: failed to parse JSON response');
	});
	return { payload };
};
