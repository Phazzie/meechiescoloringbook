// Purpose: Apply shared text/image rate-limit policy before billable provider work.
// Why: Every caller needs the same fail-closed status and reset-derived response headers.
// Info flow: policy + client lookup -> store selection -> pseudonymous identity -> RateLimitSeam -> HTTP-ready decision.
//
// Store selection (three states, never two):
// 1. Every durable setting present and valid -> the durable Upstash-backed seam.
// 2. UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN and RATE_LIMIT_IDENTITY_SECRET all blank ->
//    degraded mode on the bounded in-process seam. Same 20/min and 8/min budgets, per process.
// 3. Anything in between - one credential set, a typo'd URL, an unparseable timeout -> 503.
//    Somebody tried to configure durable limiting and got it wrong; degrading silently would hide
//    a production misconfiguration.
// There is deliberately no flag, env var, or input that reaches a provider without a limiter.
import { env as privateEnv } from '$env/dynamic/private';
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
import {
	getMemoryRateLimitSeam,
	memoryRateLimitIdentitySecret
} from './rate-limit-memory-store';

export const RATE_LIMIT_POLICIES = {
	text: { limit: TEXT_RATE_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS },
	image: { limit: IMAGE_RATE_LIMIT, windowMs: RATE_LIMIT_WINDOW_MS }
} as const;

/** Which store served a decision. Reported, never logged. */
export type RateLimitStoreKind = 'durable' | 'memory';

// Only these three decide "configured at all". RATE_LIMIT_OPERATION_TIMEOUT_MS is deliberately
// excluded: .env.example ships it with a value while the credentials stay blank, so counting it
// would classify a stock developer environment as a broken durable configuration.
const DURABLE_RATE_LIMIT_KEYS = [
	'UPSTASH_REDIS_REST_URL',
	'UPSTASH_REDIS_REST_TOKEN',
	'RATE_LIMIT_IDENTITY_SECRET'
] as const;

// Same emptiness test loadRateLimitConfig uses, so no value can be "present" to the loader and
// "absent" to this classifier.
const isBlank = (value: string | undefined): boolean =>
	typeof value !== 'string' || value.trim().length === 0;

/** True only when every durable setting is blank, i.e. nobody configured durable limiting at all. */
export const isDurableRateLimitConfigAbsent = (
	environment: Record<string, string | undefined>
): boolean => DURABLE_RATE_LIMIT_KEYS.every((key) => isBlank(environment[key]));

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
			store: RateLimitStoreKind;
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
	loadConfig?: (
		environment: Record<string, string | undefined>
	) => RateLimitConfig;
	/** Read once per request; the same snapshot feeds loadConfig and the absence classifier. */
	readEnvironment?: () => Record<string, string | undefined>;
	createSeam?: (config: RateLimitConfig) => RateLimitSeam;
	/** Must return one process-wide instance; a per-request instance would disable metering. */
	createMemorySeam?: () => RateLimitSeam;
	memoryIdentitySecret?: () => string;
	resolveIdentity?: (input: RateLimitIdentityInput) => RateLimitIdentity;
	now?: () => number;
};

type RateLimitStorePlan = {
	store: RateLimitStoreKind;
	identitySecret: string;
	buildSeam: () => RateLimitSeam;
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
	const readEnvironment = dependencies.readEnvironment ?? (() => privateEnv);
	const buildDurableSeam =
		dependencies.createSeam ??
		((config: RateLimitConfig) =>
			createRateLimitSeam({
				restUrl: config.upstashRestUrl,
				restToken: config.upstashRestToken,
				timeoutMs: config.operationTimeoutMs
			}));
	const buildMemorySeam = dependencies.createMemorySeam ?? getMemoryRateLimitSeam;
	const memorySecret =
		dependencies.memoryIdentitySecret ?? memoryRateLimitIdentitySecret;
	const identify = dependencies.resolveIdentity ?? resolveRateLimitIdentity;
	const now = dependencies.now ?? Date.now;

	// Degraded mode is reachable only when loading the durable config failed AND every durable
	// setting is blank. Either condition alone is not enough, so a partial or invalid
	// configuration can never be mistaken for an unconfigured one.
	const planStore = (): RateLimitStorePlan | null => {
		// Read the environment once and hand the same snapshot to the loader and the
		// classifier, so they can never disagree about what is configured.
		let environment: Record<string, string | undefined>;
		try {
			environment = readEnvironment();
		} catch {
			return null;
		}

		try {
			const config = readConfig(environment);
			return {
				store: 'durable',
				identitySecret: config.identitySecret,
				buildSeam: () => buildDurableSeam(config)
			};
		} catch {
			// Durable limiting is not usable; classify why before degrading.
		}

		if (!isDurableRateLimitConfigAbsent(environment)) return null;

		try {
			return {
				store: 'memory',
				identitySecret: memorySecret(),
				buildSeam: buildMemorySeam
			};
		} catch {
			return null;
		}
	};

	return async (input: RateLimitGuardInput): Promise<RateLimitGuardResult> => {
		const plan = planStore();
		if (!plan) return unavailable();

		let identity: RateLimitIdentity;
		let seam: RateLimitSeam;
		try {
			identity = identify({
				identitySecret: plan.identitySecret,
				getClientAddress: input.getClientAddress
			});
			seam = plan.buildSeam();
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
				store: plan.store,
				limit: decision.limit,
				remaining: decision.remaining,
				resetAtMs: decision.resetAtMs
			};
		} catch {
			return unavailable();
		}
	};
};
