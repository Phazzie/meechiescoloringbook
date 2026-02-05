// Purpose: Adapter implementation for AuthContextSeam.
// Why: Provide deterministic anonymous auth context in v1.
// Info flow: Session input -> auth context -> capability checks.
import type { AuthContext, AuthContextInput, AuthContextSeam } from '../../../contracts/auth-context.contract';
import type { Result } from '../../../contracts/shared.contract';

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
