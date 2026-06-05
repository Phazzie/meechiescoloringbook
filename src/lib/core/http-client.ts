// Purpose: Centralize browser JSON request helpers for client routes.
// Why: Remove duplicated fetch/header logic between builder and Meechie tools.
// Info flow: UI state -> shared helper -> API request/response payload.

export const buildJsonHeaders = (): Record<string, string> => ({
	'Content-Type': 'application/json'
});

// Thrown by postJson on non-2xx responses so callers can use try/catch.
// `payload` carries the parsed JSON body (e.g. a contract-shaped { ok: false, error: ... })
// so callers can still inspect the structured API error while keeping type safety.
export class HttpError extends Error {
	readonly status: number;
	readonly payload: unknown;

	constructor(message: string, status: number, payload: unknown) {
		super(message);
		this.name = 'HttpError';
		this.status = status;
		this.payload = payload;
	}
}

export const postJson = async <T = unknown>(url: string, body: unknown): Promise<T> => {
	const response = await fetch(url, {
		method: 'POST',
		headers: buildJsonHeaders(),
		body: JSON.stringify(body)
	});
	if (response.status === 204 || response.status === 205) return undefined as T;

	const raw = await response.text();
	if (raw.trim().length === 0) {
		if (response.ok) return undefined as T;
		throw new Error(
			`postJson: HTTP ${response.status} ${response.statusText} from ${url}: empty response body`
		);
	}

	let payload: unknown;
	try {
		payload = JSON.parse(raw);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		if (!response.ok) {
			throw new Error(
				`postJson: HTTP ${response.status} ${response.statusText} from ${url}: failed to parse JSON response: ${reason}`
			);
		}
		throw new Error(
			`postJson: failed to parse JSON response from ${url} (HTTP ${response.status} ${response.statusText}): ${reason}`
		);
	}

	if (!response.ok) {
		throw new HttpError(
			`postJson: HTTP ${response.status} ${response.statusText} from ${url}`,
			response.status,
			payload
		);
	}

	return payload as T;
};
