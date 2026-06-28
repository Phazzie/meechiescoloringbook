// Purpose: Shared test factory for unique fake client addresses.
// Why: Avoid duplicating the same counter/address-generator across every rate-limited route test.
// Info flow: Imported by unit tests -> per-test counter -> unique IPv4-shaped address per call.
export function createClientAddressCounter() {
	let counter = 0;
	return () => `198.51.100.${++counter}`;
}
