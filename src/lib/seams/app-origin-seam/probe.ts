// Purpose: Document the AppOriginSeam probe strategy.
// Why: The real behaviour is `globalThis.location.origin`, a browser property with no credentials,
//      no network, and no service that can change beneath us. The probe is therefore a local
//      assertion rather than a live call, and it runs inside the contract test.
// Info flow: N/A — see `test.ts`, "AppOriginSeam adapter against the real host".
//
// What the contract test proves about the adapter:
//   1. With a location present, it reports exactly `location.origin`.
//   2. With no location at all (server render), it reports '' rather than throwing.
//   3. A location whose origin is malformed or non-http(s) degrades to '' rather than being
//      forwarded into the same-origin comparison.
//
// Manual verification, if ever needed: run `npm run dev`, save a page to the vault, and confirm in
// DevTools that a stored same-origin absolute URL renders while an off-origin one does not.
export {};
