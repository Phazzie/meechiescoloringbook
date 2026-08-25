// Purpose: Redact sensitive identifiers from provider-authored error messages.
// Why: Runtime responses and fixture probes both surface provider text and must not leak account data.
// Info flow: provider message -> shared redaction rules -> API error or committed fixture.

/** @type {Array<[RegExp, string]>} */
const REDACTIONS = [
	[/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[redacted-id]'],
	[/\b(?:xai|sk|key)-[A-Za-z0-9_-]{16,}/gi, '[redacted-key]'],
	[/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted-email]'],
	[/\b[A-Fa-f0-9]{32,}\b/g, '[redacted-id]']
];

/**
 * @param {string} message
 * @returns {string}
 */
export const redactProviderMessage = (message) =>
	REDACTIONS.reduce(
		(redacted, [pattern, replacement]) => redacted.replace(pattern, replacement),
		message
	);
