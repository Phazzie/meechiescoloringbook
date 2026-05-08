// Purpose: Centralize browser JSON request helpers for client routes.
// Why: Remove duplicated fetch/header logic between builder and Meechie tools.
// Info flow: UI state -> shared helper -> API request/response payload.

export const buildJsonHeaders = (): Record<string, string> => ({
	'Content-Type': 'application/json'
});

const getErrorMessageFromPayload = (payload: unknown): string | null => {
	if (!payload || typeof payload !== 'object') {
		return null;
	}

	const error = (payload as { error?: unknown }).error;
	if (error && typeof error === 'object') {
		const errorMessage = (error as { message?: unknown }).message;
		if (typeof errorMessage === 'string' && errorMessage.trim().length > 0) {
			return errorMessage;
		}
	}

	const message = (payload as { message?: unknown }).message;
	if (typeof message === 'string' && message.trim().length > 0) {
		return message;
	}

	return null;
};

export class HttpResponseError extends Error {
	readonly response: Response;
	readonly payload: unknown;

	constructor(response: Response, payload: unknown) {
		super(
			getErrorMessageFromPayload(payload) ??
				`HTTP ${response.status}: ${response.statusText || 'Unknown error'}`
		);
		this.name = 'HttpResponseError';
		this.response = response;
		this.payload = payload;
	}
}

export const postJson = async (
	url: string,
	body: unknown
): Promise<{ response: Response; payload: unknown }> => {
	const response = await fetch(url, {
		method: 'POST',
		headers: buildJsonHeaders(),
		body: JSON.stringify(body)
	});
	const payload = await response.json().catch(() => null);
	const isOk =
		typeof response.ok === 'boolean'
			? response.ok
			: response.status >= 200 && response.status < 300;
	if (!isOk) {
		throw new HttpResponseError(response, payload);
	}
	return { response, payload };
};
