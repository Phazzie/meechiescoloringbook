// Purpose: Contract tests for PageVisibilitySeam — the mock, the validator, and the adapter.
// Why: "The reader came back to the tab" is the trigger for refreshing saved-date labels, so the
//      transition has to be provable, and the fault fixtures have to fail before the adapter.
// Info flow: tests -> mock / validators / adapter -> contract assertions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPageVisibilitySeam } from '../../adapters/page-visibility-seam';
import {
	hiddenState,
	invalidStates,
	missingState,
	nonsenseState,
	prerenderState,
	visibleState
} from './fixtures';
import { createMockPageVisibilitySeam } from './mock';
import { isVisibleState } from './validators';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('PageVisibilitySeam mock contract', () => {
	it('reports the state its scenario starts in', () => {
		expect(createMockPageVisibilitySeam('visible').isVisible()).toBe(true);
		expect(createMockPageVisibilitySeam('hidden').isVisible()).toBe(false);
	});

	it('announces a return to visibility', () => {
		const visibility = createMockPageVisibilitySeam('hidden');
		const returned = vi.fn();
		visibility.onVisible(returned);

		visibility.setVisible(true);

		expect(returned).toHaveBeenCalledTimes(1);
		expect(visibility.isVisible()).toBe(true);
	});

	// The browser fires `visibilitychange` in both directions; only the return is a trigger here.
	it('does not announce becoming hidden', () => {
		const visibility = createMockPageVisibilitySeam('visible');
		const returned = vi.fn();
		visibility.onVisible(returned);

		visibility.setVisible(false);

		expect(returned).not.toHaveBeenCalled();
	});

	it('does not announce a repeated visible state', () => {
		const visibility = createMockPageVisibilitySeam('visible');
		const returned = vi.fn();
		visibility.onVisible(returned);

		visibility.setVisible(true);

		expect(returned).not.toHaveBeenCalled();
	});

	it('announces every return, not only the first', () => {
		const visibility = createMockPageVisibilitySeam('visible');
		const returned = vi.fn();
		visibility.onVisible(returned);

		visibility.setVisible(false);
		visibility.setVisible(true);
		visibility.setVisible(false);
		visibility.setVisible(true);

		expect(returned).toHaveBeenCalledTimes(2);
	});

	it('stops announcing once unsubscribed', () => {
		const visibility = createMockPageVisibilitySeam('hidden');
		const returned = vi.fn();
		const stop = visibility.onVisible(returned);

		stop();
		visibility.setVisible(true);

		expect(returned).not.toHaveBeenCalled();
		expect(visibility.subscriberCount()).toBe(0);
	});

	// A subscriber that tears itself down from inside its own callback must not cause the next
	// subscriber to be skipped.
	it('notifies every subscriber even when one unsubscribes itself mid-notification', () => {
		const visibility = createMockPageVisibilitySeam('hidden');
		const second = vi.fn();
		const stopFirst = visibility.onVisible(() => stopFirst());
		visibility.onVisible(second);

		visibility.setVisible(true);

		expect(second).toHaveBeenCalledTimes(1);
	});

	// `EventTarget` does not call a listener removed before its turn came, so the mock must not
	// either — otherwise a test could observe a callback production would have skipped.
	it('skips a subscriber removed by an earlier subscriber during the same notification', () => {
		const visibility = createMockPageVisibilitySeam('hidden');
		const second = vi.fn();
		let stopSecond = (): void => {};
		visibility.onVisible(() => stopSecond());
		stopSecond = visibility.onVisible(second);

		visibility.setVisible(true);

		expect(second).not.toHaveBeenCalled();
	});

	// A host that starts at `prerender` resolves to visible, but moving to a real `visible` state
	// is still a transition the browser announces. Resolving at construction would have erased it.
	it('announces the move out of a fault state into a real visible state', () => {
		const visibility = createMockPageVisibilitySeam('prerender');
		const returned = vi.fn();
		visibility.onVisible(returned);

		visibility.setVisible(true);

		expect(returned).toHaveBeenCalledTimes(1);
	});

	// The fault fixtures must fail through the mock, not only through the validator: a host state
	// outside the spec has to resolve to a definite answer rather than propagate as "unknown".
	it.each(['prerender', 'nonsense', 'missing'] as const)(
		'resolves the %s fault scenario to visible',
		(scenario) => {
			expect(createMockPageVisibilitySeam(scenario).isVisible()).toBe(true);
		}
	);
});

describe('PageVisibilitySeam validators', () => {
	it('accepts the two states the spec defines', () => {
		expect(isVisibleState(visibleState)).toBe(true);
		expect(isVisibleState(hiddenState)).toBe(false);
	});

	// Biased towards visible on purpose: a wrong `true` costs a refresh nobody needed, a wrong
	// `false` silently withholds one the reader is waiting on.
	it.each([
		['an out-of-spec state', prerenderState],
		['a missing state', missingState],
		['nonsense', nonsenseState]
	])('resolves %s to visible rather than propagating it', (_label, value) => {
		expect(isVisibleState(value)).toBe(true);
	});

	it('resolves every fault fixture to visible', () => {
		for (const state of invalidStates) {
			expect(isVisibleState(state)).toBe(true);
		}
	});
});

describe('PageVisibilitySeam adapter against the real host', () => {
	it('reports what the document says', () => {
		vi.stubGlobal('document', { visibilityState: 'hidden', addEventListener: vi.fn() });

		expect(createPageVisibilitySeam().isVisible()).toBe(false);
	});

	it('reports visible during a server render with no document', () => {
		vi.stubGlobal('document', undefined);

		expect(createPageVisibilitySeam().isVisible()).toBe(true);
	});

	it('subscribing is a harmless no-op with no document', () => {
		vi.stubGlobal('document', undefined);
		const returned = vi.fn();

		const stop = createPageVisibilitySeam().onVisible(returned);

		expect(() => stop()).not.toThrow();
		expect(returned).not.toHaveBeenCalled();
	});

	it('runs the callback when the real event fires and the page is visible', () => {
		const returned = vi.fn();
		const stop = createPageVisibilitySeam().onVisible(returned);

		document.dispatchEvent(new Event('visibilitychange'));

		expect(returned).toHaveBeenCalledTimes(1);
		stop();
	});

	it('detaches the real listener on unsubscribe', () => {
		const returned = vi.fn();

		const stop = createPageVisibilitySeam().onVisible(returned);
		stop();
		document.dispatchEvent(new Event('visibilitychange'));

		expect(returned).not.toHaveBeenCalled();
	});
});
