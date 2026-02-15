// Purpose: Centralize browser API-key storage and JSON request helpers for client routes.
// Why: Remove duplicated fetch/header logic between builder and Meechie tools.
// Info flow: UI state -> shared helper -> API request/response payload.

export const TEMP_API_KEY_STORAGE_KEY = 'meechie_temp_api_key';

export const loadStoredApiKey = (): string => {
	if (typeof window === 'undefined') {
		return '';
	}
	return window.localStorage.getItem(TEMP_API_KEY_STORAGE_KEY)?.trim() ?? '';
};

export const saveStoredApiKey = (value: string): void => {
	if (typeof window === 'undefined') {
		return;
	}
	window.localStorage.setItem(TEMP_API_KEY_STORAGE_KEY, value.trim());
};

export const clearStoredApiKey = (): void => {
	if (typeof window === 'undefined') {
		return;
	}
	window.localStorage.removeItem(TEMP_API_KEY_STORAGE_KEY);
};

export const buildJsonHeaders = (apiKey?: string): Record<string, string> => {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};
	const trimmed = apiKey?.trim();
	if (trimmed && trimmed.length > 0) {
		headers['x-api-key'] = trimmed;
	}
	return headers;
};

export const postJson = async (
	url: string,
	body: unknown,
	apiKey?: string
): Promise<{ response: Response; payload: unknown }> => {
	const response = await fetch(url, {
		method: 'POST',
		headers: buildJsonHeaders(apiKey),
		body: JSON.stringify(body)
	});
	const payload = await response.json().catch(() => null);
	return { response, payload };
};
