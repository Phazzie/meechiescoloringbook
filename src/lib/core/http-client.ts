// Purpose: Centralize browser JSON request helpers for client routes.
// Why: Remove duplicated fetch/header logic between builder and Meechie tools.
// Info flow: UI state -> shared helper -> API request/response payload.

export const buildJsonHeaders = (): Record<string, string> => ({
	'Content-Type': 'application/json'
});

export const postJson = async <T = unknown>(url: string, body: unknown): Promise<T> => {
	const response = await fetch(url, {
		method: 'POST',
		headers: buildJsonHeaders(),
		body: JSON.stringify(body)
	});
	if (response.status === 204) return undefined as T;
	const payload = await response.json().catch((err: unknown) => {
		throw new Error(
			`postJson: failed to parse JSON response (HTTP ${response.status}): ${err instanceof Error ? err.message : String(err)}`
		);
	});
	if (!response.ok) {
		// Preserve structured error messages that endpoints intentionally return on non-2xx responses.
		const errPayload = payload as Record<string, unknown>;
		const structured =
			errPayload != null &&
			typeof errPayload === 'object' &&
			typeof errPayload['error'] === 'object' &&
			errPayload['error'] != null &&
			typeof (errPayload['error'] as Record<string, unknown>)['message'] === 'string'
				? (errPayload['error'] as { message: string }).message
				: null;
		throw new Error(structured ?? `postJson: HTTP ${response.status} ${response.statusText}`);
	}
	return payload as T;
};
