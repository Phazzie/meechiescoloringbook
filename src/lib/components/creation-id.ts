// Purpose: Mint the id a saved coloring page is stored under.
// Why: Three surfaces write to the Quote Vault, and until now each minted its own id. Only one of
//      the three — `page-artifact-state.svelte.ts`, which covers thirteen page-making surfaces —
//      had worked the problem through; the home studio (`studio-state.svelte.ts`) and the tools hub
//      (`MeechieTools.svelte`) both fell back to `creation-${Date.now()}` when
//      `crypto.randomUUID` was unavailable. A save replaces any stored record sharing its id, so on
//      a browser without `randomUUID` — plain HTTP, some embedded webviews — two saves in the same
//      millisecond destroyed the first, silently, on the two oldest surfaces in the app. This is
//      that one reasoned implementation, moved somewhere all three can reach it.
// Info flow: Web Crypto when it is there -> a hex id; otherwise a clock/document/counter id.
// Invariants:
//   - Never `Math.random()`. Reaching for a pseudorandom source when a cryptographic one sits right
//     above it is the habit SonarCloud's PRNG rule exists to break.
//   - This deliberately does NOT live in `src/lib/core`. Core is declared deterministic and this is
//     not: it reads Web Crypto, and its last-resort branch reads the clock. A review round put the
//     first draft in core and was right to object. It sits beside the components that save instead —
//     browser-side helper code for browser-side callers — so the three savers still share one
//     answer without core acquiring a non-deterministic exception.
//   - Routing it through a seam of its own, which `AGENTS.md` implies for randomness and clock, would
//     need a new contract, probe, fixtures, mock and adapter. That is a contract addition and its own
//     change; this one only reduces three implementations to one. Carried in `WORST_TO_BEST_LOG.md`.

/**
 * Separates saves made within one document, which the clock alone could not do.
 */
let fallbackCounter = 0;

/**
 * A value that differs between two documents of the same origin, without a PRNG.
 *
 * `performance.timeOrigin` is the instant *this document* started, at sub-millisecond resolution,
 * so two tabs almost never share one. It exists only to separate tabs in the last-resort id below;
 * it is not a secret and nothing depends on it being unguessable.
 */
const documentToken = ((): string => {
	if (typeof performance === 'undefined') return '0';
	const origin =
		typeof performance.timeOrigin === 'number' ? performance.timeOrigin : 0;
	return Math.trunc((origin + performance.now()) * 1000).toString(36);
})();

/**
 * A record id that cannot collide with another save.
 *
 * `crypto.randomUUID` is gated on a secure context, so it is simply absent over plain HTTP and in
 * some embedded webviews. `crypto.getRandomValues` is *not* secure-context gated, so it covers
 * almost everything `randomUUID` misses.
 *
 * The last resort mixes three things because the collisions are three different ones: the clock
 * separates instants, the counter separates saves within one document, and `documentToken`
 * separates documents — two tabs each start their own counter at zero, so both would otherwise emit
 * `-1` in the same millisecond.
 *
 * That last branch is a bound, not a proof: two documents whose `timeOrigin` matches to the
 * microsecond, saving in the same millisecond, would still collide. Reaching it at all requires a
 * browser with no Web Crypto whatsoever, which no browser able to run this app has been for over a
 * decade.
 */
export const newCreationId = (): string => {
	if (typeof crypto !== 'undefined') {
		if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
		if (typeof crypto.getRandomValues === 'function') {
			const bytes = crypto.getRandomValues(new Uint8Array(16));
			const hex = Array.from(bytes, (byte) =>
				byte.toString(16).padStart(2, '0')
			).join('');
			return `creation-${hex}`;
		}
	}
	fallbackCounter += 1;
	return `creation-${Date.now()}-${documentToken}-${fallbackCounter}`;
};
