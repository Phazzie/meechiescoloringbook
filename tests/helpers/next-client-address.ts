// Purpose: Shared unique-client-address generator for API route unit tests.
// Why: RateLimitSeam keeps in-memory state per module; giving each test call its own key
//      avoids cross-contaminating unrelated assertions with shared rate-limit counters.
// Info flow: Imported by unit tests -> unique key per call -> RequestEvent.getClientAddress stub.
let clientCounter = 0;

export const nextClientAddress = (): string => `test-client-${clientCounter++}`;
