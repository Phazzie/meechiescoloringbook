// Purpose: Apply shared text/image rate-limit policy before billable provider work.
// Why: Every caller needs the same fail-closed status and reset-derived response headers.
// Info flow: policy + client lookup -> pseudonymous identity -> RateLimitSeam -> HTTP-ready decision.
import { createRateLimitSeam } from '$lib/adapters/rate-limit-seam';
import type {
	RateLimitBucket,
	RateLimitDecision,
	RateLimitSeam
} from '$lib/seams/rate-limit-seam/contract';
import {
	IMAGE_RATE_LIMIT,
	RATE_LIMIT_WINDOW_MS,
	TEXT_RATE_LIMIT,
	validateRateLimitDecision
} from '$lib/seams/rate-limit-seam/validators';
import {
	loadRateLimitConfig,
	type RateLimitConfig
} from './rate-limit-config';
import {
	resolveRateLimitIdentity,
	type RateLimitIdentity,
	type RateLimitIdentityInput
} from './rate-limit-identity';

export const RATE_LIMIT_POLICIES = {
	text: { limit: TEXT_RATE_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS },
	image: { limit: IMAGE_RATE_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS }
} as const;

export type RateLimitGuardInput = {
	bucket: RateLimitBucket;
	cost?: number;
	getClientAddress?: () => string | undefined;
};

export type RateLimitGuardError = {
	code: 'RATE_LIMITED' | 'RATE_LIMIT_UNAVAILABLE';
	message: string;
};

export type RateLimitGuardResult =
	| {
			ok: true;
			status: 200;
			headers: Record<string, string>;
			identityKind: RateLimitIdentity['kind'];
			limit: number;
			remaining: number;
			resetAtMs: number;
	  }
	| {
			ok: false;
			status: 429 | 503;
			headers: Record<string, string>;
			error: RateLimitGuardError;
	  };

export type RateLimitGuardDependencies = {
	loadConfig?: () => RateLimitConfig;
	createSeam?: (config: RateLimitConfig) => RateLimitSeam;
	resolveIdentity?: (input: RateLimitIdentityInput) => RateLimitIdentity;
	now?: () => number;
};

const unavailable = (): RateLimitGuardResult => ({
	ok: false,
	status: 503,
	headers: { 'Cache-Control': 'no-store' },
	error: {
		code: 'RATE_LIMIT_UNAVAILABLE',
		message: 'Rate limiting is temporarily unavailable.'
	}
});

const decisionHeaders = (
	decision: RateLimitDecision,
	nowMs: number,
	includeRetryAfter: boolean
): Record<string, string> => {
	const resetAfterSeconds = Math.max(
		0,
		Math.ceil((decision.resetAtMs - nowMs) / 1_000)
	);
	return {
		'Cache-Control': 'no-store',
		'RateLimit-Limit': String(decision.limit),
		'RateLimit-Remaining': String(decision.remaining),
		'RateLimit-Reset': String(resetAfterSeconds),
		...(includeRetryAfter
			? { 'Retry-After': String(Math.max(1, resetAfterSeconds)) }
			: {})
	};
};

export const createRateLimitGuard = (
	dependencies: RateLimitGuardDependencies = {}
) => {
	const readConfig = dependencies.loadConfig ?? loadRateLimitConfig;
	const buildSeam =
		dependencies.createSeam ??
		((config: RateLimitConfig) =>
			createRateLimitSeam({
				restUrl: config.upstashRestUrl,
				restToken: config.upstashRestToken,
				timeoutMs: config.operationTimeoutMs
			}));
	const identify = dependencies.resolveIdentity ?? resolveRateLimitIdentity;
	const now = dependencies.now ?? Date.now;

	return async (input: RateLimitGuardInput): Promise<RateLimitGuardResult> => {
		let config: RateLimitConfig;
		let identity: RateLimitIdentity;
		let seam: RateLimitSeam;
		try {
			config = readConfig();
			identity = identify({
				identitySecret: config.identitySecret,
				getClientAddress: input.getClientAddress
			});
			seam = buildSeam(config);
		} catch {
			return unavailable();
		}

		const policy = RATE_LIMIT_POLICIES[input.bucket];
		if (!policy) return unavailable();

		try {
			const consumed = await seam.consume({
				identityKey: identity.key,
				bucket: input.bucket,
				limit: policy.limit,
				windowMs: policy.windowMs,
				cost: input.cost ?? 1
			});
			if (!consumed.ok) return unavailable();

			let decision: RateLimitDecision;
			try {
				decision = validateRateLimitDecision(consumed.value);
			} catch {
				return unavailable();
			}
			const nowMs = Math.max(0, Math.floor(now()));
			const headers = decisionHeaders(decision, nowMs, !decision.allowed);
			if (!decision.allowed) {
				return {
					ok: false,
					status: 429,
					headers,
					error: {
						code: 'RATE_LIMITED',
						message: 'Too many requests. Try again after the current window resets.'
					}
				};
			}

			return {
				ok: true,
				status: 200,
				headers,
				identityKind: identity.kind,
				limit: decision.limit,
				remaining: decision.remaining,
				resetAtMs: decision.resetAtMs
			};
		} catch {
			return unavailable();
		}
	};
};
