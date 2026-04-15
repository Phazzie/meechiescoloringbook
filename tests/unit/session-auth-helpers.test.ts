// Purpose: Unit tests for session and auth-context adapter edge cases.
// Why: Ensure session ID generation, storage, and auth context validation work correctly.
// Info flow: Adapter calls -> localStorage/crypto -> verified outputs.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sessionAdapter } from '../../src/lib/adapters/session.adapter';
import { authContextAdapter } from '../../src/lib/adapters/auth-context.adapter';

describe('session adapter', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('creates a new session when none exists', async () => {
		const result = await sessionAdapter.getSession();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.sessionId.length).toBeGreaterThan(0);
		}
	});

	it('returns same session ID on subsequent calls', async () => {
		const first = await sessionAdapter.getSession();
		const second = await sessionAdapter.getSession();
		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		if (first.ok && second.ok) {
			expect(first.value.sessionId).toBe(second.value.sessionId);
		}
	});

	it('returns existing session from localStorage', async () => {
		localStorage.setItem('cb_session_id_v1', 'pre-existing-session');
		const result = await sessionAdapter.getSession();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.sessionId).toBe('pre-existing-session');
		}
	});

	it('generates new ID when localStorage has empty string', async () => {
		localStorage.setItem('cb_session_id_v1', '');
		const result = await sessionAdapter.getSession();
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.sessionId.length).toBeGreaterThan(0);
			expect(result.value.sessionId).not.toBe('');
		}
	});
});

describe('auth-context adapter', () => {
	it('returns anonymous context for valid session', async () => {
		const result = await authContextAdapter.getAuthContext({
			sessionId: 'valid-session-123'
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.kind).toBe('anonymous');
			expect(result.value.capabilities).toContain('generate');
			expect(result.value.capabilities).toContain('store');
			expect(result.value.rateLimitTier).toBe('anonymous');
		}
	});

	it('returns anonymous context when sessionId is undefined', async () => {
		const result = await authContextAdapter.getAuthContext({});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.kind).toBe('anonymous');
		}
	});

	it('rejects session ID with special characters', async () => {
		const result = await authContextAdapter.getAuthContext({
			sessionId: 'invalid session!'
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('SESSION_ID_INVALID');
		}
	});

	it('rejects session ID with spaces', async () => {
		const result = await authContextAdapter.getAuthContext({
			sessionId: 'has spaces'
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('SESSION_ID_INVALID');
		}
	});

	it('accepts session ID with hyphens and underscores', async () => {
		const result = await authContextAdapter.getAuthContext({
			sessionId: 'valid-session_id-123'
		});
		expect(result.ok).toBe(true);
	});

	it('accepts alphanumeric session ID', async () => {
		const result = await authContextAdapter.getAuthContext({
			sessionId: 'abc123DEF456'
		});
		expect(result.ok).toBe(true);
	});
});
