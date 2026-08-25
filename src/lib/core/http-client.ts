// Purpose: Centralize browser JSON request helpers for client routes.
// Why: Remove duplicated fetch/header logic between builder and Meechie tools.
// Info flow: UI state -> shared helper -> API request/response payload.

import { fetchWithTimeout, isTimeoutError } from './http-resilience';

export const buildJsonHeaders = (): Record<string, string> => ({
	'Content-Type': 'application/json'
});

// Browser budgets remain above the single 110s server-side chat-provider attempt. Provider
// chats are not retried, so server work ends before the shortest client budget instead of
// continuing after the browser has already reported failure.
export const POST_JSON_TIMEOUTS_MS = {
	tools: 120_000,
	studioText: 150_000,
	generate: 180_000,
	wigTryOn: 150_000
} as const;

export type PostJsonOptions = {
	timeoutMs?: number;
};

const formatTimeoutSeconds = (timeoutMs: number): string => {
	const seconds = timeoutMs / 1000;
	return Number.isInteger(seconds) ? `${seconds}s` : `${timeoutMs}ms`;
};

export const postJson = async <T = unknown>(
	url: string,
	body: unknown,
	options: PostJsonOptions = {}
): Promise<T> => {
	const requestInit: RequestInit = {
		method: 'POST',
		headers: buildJsonHeaders(),
		body: JSON.stringify(body)
	};
	const response = await (async (): Promise<Response> => {
		try {
			return options.timeoutMs === undefined
				? await fetch(url, requestInit)
				: await fetchWithTimeout(url, requestInit, options.timeoutMs);
		} catch (error) {
			if (options.timeoutMs !== undefined && isTimeoutError(error)) {
				throw new Error(
					`Request timed out after ${formatTimeoutSeconds(options.timeoutMs)}. The AI took too long to respond - please try again.`
				);
			}
			throw error;
		}
	})();

	if (response.status === 204 || response.status === 205) return undefined as T;

	const raw = await response.text();
	if (raw.trim().length === 0) {
		if (response.ok) return undefined as T;
		throw new Error(
			`postJson: HTTP ${response.status} ${response.statusText} from ${url}: empty response body`
		);
	}

	try {
		return JSON.parse(raw) as T;
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
};
