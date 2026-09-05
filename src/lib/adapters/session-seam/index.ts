/*
 * Purpose: Canonical SessionSeam adapter implementation.
 * Why: Provide stable anonymous session identity in the browser.
 * Info flow: Browser localStorage -> SessionContext -> downstream seams.
 * Invariants: Must return BROWSER_REQUIRED if localStorage is undefined; generated sessions must be unique non-empty strings.
 */
import type { SessionContext, SessionSeam } from '../../seams/session-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';

const SESSION_KEY = 'cb_session_id_v1';

const generateSessionId = (): string => {
	if (typeof crypto !== 'undefined') {
		if (typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		if (typeof crypto.getRandomValues === 'function') {
			const bytes = new Uint8Array(16);
			crypto.getRandomValues(bytes);
			return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
		}
	}
	const perf =
		typeof performance !== 'undefined' && typeof performance.now === 'function'
			? Math.floor(performance.now() * 1000)
			: 0;
	return `session-${Date.now()}-${perf}`;
};

export const sessionAdapter: SessionSeam = {
	getSession: async (): Promise<Result<SessionContext>> => {
		if (typeof localStorage === 'undefined') {
			return {
				ok: false,
				error: {
					code: 'BROWSER_REQUIRED',
					message: 'Session access requires a browser environment.'
				}
			};
		}

		const existing = localStorage.getItem(SESSION_KEY);
		if (existing && existing.length > 0) {
			return { ok: true, value: { sessionId: existing } };
		}

		const sessionId = generateSessionId();
		localStorage.setItem(SESSION_KEY, sessionId);
		return { ok: true, value: { sessionId } };
	}
};
