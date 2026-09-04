// Purpose: Document the ClockSeam probe strategy.
// Why: A probe exists to prove the adapter matches the real world. For this seam the "real world"
//      is `Date.now()` and `setTimeout`, which are Node and browser built-ins with no credentials,
//      no network, and no service that can change under us — so the probe is a local assertion
//      rather than a live call, and it runs in the contract test rather than as a separate script.
// Info flow: N/A — see `test.ts`, "ClockSeam adapter against the real host clock".
//
// What the contract test actually proves about the adapter:
//   1. `now()` tracks the host clock: two reads bracket a `Date.now()` taken between them.
//   2. `scheduleAt` fires for a boundary in the near future, and fires for one already past
//      rather than hanging forever.
//   3. The returned cancel function prevents the callback from running.
//
// No fixture refresh is needed: the adapter is a thin pass-through over a stable platform API.
// If that stops being true — a host without `setTimeout`, or a clock source other than
// `Date.now()` — this file and the adapter change together.
export {};
