// Purpose: Turn a SvelteKit RequestEvent into a quota gate the billable routes call before their first provider request.
// Why: The guard can only meter per caller if a route threads SvelteKit's real event.getClientAddress into it.
// Info flow: RequestEvent -> createQuotaGate -> rate-limit guard -> allowed headers or a ready-to-send denial.
//
// Contract notes for the six route tickets:
// - Build the gate once per request from the route's own `event`, then call it immediately before the
//   first billable provider call, with the cost that call charges (usually 1).
// - `createQuotaGate` passes `() => event.getClientAddress()` to the guard. Without that wiring every
//   caller collapses into one shared fallback bucket for the whole internet, and unit tests stay green.
//   `tests/unit/rate-limit-route.test.ts` fails loudly if it is ever removed - do not "simplify" it away.
// - `event.getClientAddress()` throws in some adapters when the address cannot be determined. That is
//   handled downstream (the identity helper catches it and uses the shared fallback bucket), so routes
//   must not wrap it in their own try/catch or substitute a header value.
// - On `ok: true`, merge `headers` into the success response so it advertises remaining quota.
// - On `ok: false`, return `status`, `headers` and `body` exactly as given. The headers are derived from
//   the store's own reset instant; recomputing RateLimit-Reset or Retry-After from a route clock drifts
//   from the store and is wrong. `body` already matches the shared route error shape.
import type { RequestEvent } from '@sveltejs/kit';
import type { RateLimitBucket } from '$lib/seams/rate-limit-seam/contract';
import {
	createRateLimitGuard,
	type RateLimitGuardError
} from './rate-limit-guard';

export type QuotaGateAllowed = {
	ok: true;
	headers: Record<string, string>;
};

export type QuotaGateDenied = {
	ok: false;
	status: 429 | 503;
	headers: Record<string, string>;
	body: {
		ok: false;
		error: {
			code: RateLimitGuardError['code'];
			message: string;
		};
	};
};

export type QuotaDecision = QuotaGateAllowed | QuotaGateDenied;

/** Consume `cost` units from this caller's bucket. Called by a pipeline immediately before its first billable provider call. */
export type QuotaGate = (cost: number) => Promise<QuotaDecision>;

/** The only part of a RequestEvent a quota gate needs. */
export type QuotaGateEvent = Pick<RequestEvent, 'getClientAddress'>;

export type QuotaGateDependencies = {
	guard?: ReturnType<typeof createRateLimitGuard>;
};

export const createQuotaGate = (
	event: QuotaGateEvent,
	bucket: RateLimitBucket,
	dependencies: QuotaGateDependencies = {}
): QuotaGate => {
	const guard = dependencies.guard ?? createRateLimitGuard();

	return async (cost: number): Promise<QuotaDecision> => {
		const result = await guard({
			bucket,
			cost,
			// The whole point of this module. Wrapped in an arrow so the lookup stays bound to the
			// event and runs per request, not at gate-construction time.
			getClientAddress: () => event.getClientAddress()
		});

		if (result.ok) {
			return { ok: true, headers: result.headers };
		}

		return {
			ok: false,
			status: result.status,
			// Verbatim from the guard, including Retry-After and Cache-Control: no-store.
			headers: result.headers,
			body: {
				ok: false,
				error: {
					code: result.error.code,
					message: result.error.message
				}
			}
		};
	};
};
