// Purpose: Centralize browser JSON request helpers for client routes.
// Why: Remove duplicated fetch/header logic between builder and Meechie tools.
// Info flow: UI state -> shared helper -> API request/response payload.

import { fetchWithTimeout, isTimeoutError } from './http-resilience';

export const buildJsonHeaders = (): Record<string, string> => ({
	'Content-Type': 'application/json'
});

// tools, generate, and wigTryOn each make one provider attempt, so their budgets only need to
// clear the single 110s/120s server-side attempt. studioText is the exception: its pipeline
// makes up to two provider attempts (the initial call plus its own bounded correction retry —
// see meechie-studio-text-pipeline.ts), so its budget must clear roughly double the single
// server attempt, not just exceed it once.
export const POST_JSON_TIMEOUTS_MS = {
	tools: 120_000,
	studioText: 230_000,
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
