/*
 * Purpose: Canonical AuthContextSeam adapter implementation.
 * Why: Provide deterministic anonymous auth context resolution with session ID validation.
 * Info flow: Session input -> AuthContextSeam -> downstream authorization.
 * Invariants: Invalid session IDs containing non-alphanumeric/hyphen/underscore characters return SESSION_ID_INVALID.
 */
import type { AuthContext, AuthContextInput, AuthContextSeam } from '../../seams/auth-context-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const buildAnonymousContext = (): AuthContext => ({
	kind: 'anonymous',
	capabilities: ['generate', 'store'],
	rateLimitTier: 'anonymous'
});

export const authContextAdapter: AuthContextSeam = {
	getAuthContext: async (input: AuthContextInput): Promise<Result<AuthContext>> => {
		if (input.sessionId && !SESSION_ID_PATTERN.test(input.sessionId)) {
			return {
				ok: false,
				error: {
					code: 'SESSION_ID_INVALID',
					message: 'Session ID contains invalid characters.'
				}
			};
		}

		return {
			ok: true,
			value: buildAnonymousContext()
		};
	}
};
