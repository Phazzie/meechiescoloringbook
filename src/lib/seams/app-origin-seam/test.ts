// Purpose: Contract tests for AppOriginSeam — the mock, the validator, and the adapter's fidelity.
// Why: The origin gates whether a stored URL becomes an `<img src>` and a clickable `<a href>`, so
//      the fault fixtures must be proven to fail before the adapter is trusted.
// Info flow: tests -> mock / validators / adapter -> contract assertions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppOriginSeam } from '../../adapters/app-origin-seam';
import {
	invalidOrigins,
	malformedOrigin,
	missingOrigin,
	nonHttpOrigin,
	originWithPath,
	originWithTrailingSlash,
	otherOrigin,
	sampleOrigin
} from './fixtures';
import { createMockAppOriginSeam } from './mock';
import { toSafeOrigin } from './validators';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('AppOriginSeam mock contract', () => {
	it('reports the sample origin by default', () => {
		expect(createMockAppOriginSeam().getOrigin()).toBe(sampleOrigin);
	});

	it('reports a different origin in the other scenario', () => {
		expect(createMockAppOriginSeam('other').getOrigin()).toBe(otherOrigin);
	});

	it('reports no origin in the missing scenario', () => {
		expect(createMockAppOriginSeam('missing').getOrigin()).toBe(missingOrigin);
	});

	// The mandatory red proof, driven through the mock rather than the validator directly: each
	// fault fixture must degrade to "no origin" the same way it would in a browser. If the mock
	// ever stopped mirroring the adapter's degradation these would go red.
	it.each(['withPath', 'trailingSlash', 'nonHttp', 'malformed'] as const)(
		'degrades the %s fault fixture to no origin',
		(scenario) => {
			expect(createMockAppOriginSeam(scenario).getOrigin()).toBe('');
		}
	);

	// The consequence that actually matters: with no usable origin, no absolute URL can pass the
	// same-origin check, so a malformed host value can never widen it.
	it('never reports an origin an absolute url could match on a fault scenario', () => {
		for (const scenario of ['withPath', 'trailingSlash', 'nonHttp', 'malformed'] as const) {
			const origin = createMockAppOriginSeam(scenario).getOrigin();

			expect(origin).toBe('');
			expect(originWithPath.startsWith(origin) && origin.length > 0).toBe(false);
		}
	});
});

describe('AppOriginSeam validators', () => {
	it('accepts a clean http(s) origin', () => {
		expect(toSafeOrigin(sampleOrigin)).toBe(sampleOrigin);
		expect(toSafeOrigin('http://localhost:5173')).toBe('http://localhost:5173');
	});

	it('accepts the empty string as "no origin"', () => {
		expect(toSafeOrigin('')).toBe('');
	});

	it('treats a missing value as no origin', () => {
		expect(toSafeOrigin(undefined)).toBe('');
		expect(toSafeOrigin(null)).toBe('');
	});

	// The fault fixtures must fail. A value that is not exactly an origin would widen the
	// same-origin comparison in `vault-gallery.ts` from "same origin" to "starts with this text".
	it.each([
		['an origin carrying a path', originWithPath],
		['an origin with a trailing slash', originWithTrailingSlash],
		['a non-http(s) scheme', nonHttpOrigin],
		['a malformed value', malformedOrigin]
	])('degrades %s to no origin rather than forwarding it', (_label, value) => {
		expect(toSafeOrigin(value)).toBe('');
	});

	it('rejects every fault fixture', () => {
		for (const value of invalidOrigins) {
			expect(toSafeOrigin(value)).toBe('');
		}
	});
});

describe('AppOriginSeam adapter against the real host', () => {
	it('reports the location origin when one is present', () => {
		vi.stubGlobal('location', { origin: sampleOrigin });

		expect(createAppOriginSeam().getOrigin()).toBe(sampleOrigin);
	});

	it('reports no origin during a server render with no location', () => {
		vi.stubGlobal('location', undefined);

		expect(createAppOriginSeam().getOrigin()).toBe('');
	});

	// An opaque origin — a sandboxed iframe, a file:// page — reports the literal string "null".
	it('reports no origin for an opaque origin', () => {
		vi.stubGlobal('location', { origin: 'null' });

		expect(createAppOriginSeam().getOrigin()).toBe('');
	});

	it('reports no origin when the host hands back something that is not an origin', () => {
		vi.stubGlobal('location', { origin: originWithPath });

		expect(createAppOriginSeam().getOrigin()).toBe('');
	});
});
