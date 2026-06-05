// Purpose: Centralize browser JSON request helpers for client routes.
// Why: Remove duplicated fetch/header logic between builder and Meechie tools.
// Info flow: UI state -> shared helper -> API request/response payload.

import { fetchWithTimeout, isAbortError } from './http-resilience';

export const buildJsonHeaders = (): Record<string, string> => ({
	'Content-Type': 'application/json'
});

export type PostJsonOptions = {
	/** Abort the request after this many milliseconds and throw a user-readable timeout error. */
	timeoutMs?: number;
};

export const postJson = async <T = unknown>(
	url: string,
	body: unknown,
	options?: PostJsonOptions
): Promise<T> => {
	const { timeoutMs } = options ?? {};
	const init: RequestInit = {
		method: 'POST',
		headers: buildJsonHeaders(),
		body: JSON.stringify(body)
	};

	let response: Response;
	try {
		response =
			timeoutMs !== undefined
				? await fetchWithTimeout(url, init, timeoutMs)
				: await fetch(url, init);
	} catch (error) {
		if (isAbortError(error)) {
			throw new Error(
				`Request timed out after ${timeoutMs! / 1000}s. The AI took too long to respond — please try again.`
			);
		}
		throw error;
	}

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
