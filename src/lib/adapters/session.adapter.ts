// Purpose: Adapter implementation for SessionSeam.
// Why: Provide stable anonymous session identity in the browser.
// Info flow: Local storage -> session context -> downstream seams.
import type { SessionContext, SessionSeam } from '../../../contracts/session.contract';
import type { Result } from '../../../contracts/shared.contract';

const SESSION_KEY = 'cb_session_id_v1';

const generateSessionId = (): string => {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
