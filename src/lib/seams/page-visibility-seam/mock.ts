// Purpose: A PageVisibilitySeam whose visibility only changes when a test changes it.
// Why: "The reader came back to the tab" is a transition, and a unit test cannot produce a real
//      one. `setVisible` produces it directly and announces it to subscribers.
// Info flow: test -> createMockPageVisibilitySeam(scenario) -> fixture state -> validators -> seam.
import type { PageVisibilitySeam } from './contract';
import {
	hiddenState,
	missingState,
	nonsenseState,
	prerenderState,
	visibleState
} from './fixtures';
import { isVisibleState } from './validators';

export type PageVisibilityScenario =
	| 'visible'
	| 'hidden'
	| 'prerender'
	| 'missing'
	| 'nonsense';

/**
 * What the host reports in each scenario, before the seam has looked at it. Named scenarios backed
 * by `fixtures.ts` rather than raw strings, so the fault proof cannot drift away from the seam's
 * recorded fault data: changing a fixture changes what these tests actually exercise.
 */
const RAW_STATES: Record<PageVisibilityScenario, unknown> = {
	visible: visibleState,
	hidden: hiddenState,
	prerender: prerenderState,
	missing: missingState,
	nonsense: nonsenseState
};

export type MockPageVisibilitySeam = PageVisibilitySeam & {
	/** Change visibility. Announces only on a hidden -> visible transition, as the browser does. */
	setVisible(visible: boolean): void;
	/** How many subscribers are still attached. Proves teardown actually detached them. */
	subscriberCount(): number;
};

export const createMockPageVisibilitySeam = (
	scenario: PageVisibilityScenario = 'visible'
): MockPageVisibilitySeam => {
	// The *raw* host state is kept, not the resolved boolean. Resolving at construction would erase
	// a real transition: a host that starts at `prerender` resolves to visible, so a later move to
	// `visible` would look like no change and announce nothing — while the adapter, which sees an
	// actual `visibilitychange`, would announce it. Keeping the raw value makes the mock's notion of
	// "something changed" the same as the browser's.
	let rawState: unknown = RAW_STATES[scenario];
	// Registrations, not bare callbacks. The adapter wraps each `onVisible` call in its own listener
	// closure, so registering one callback twice really does attach two listeners and cancelling one
	// leaves the other firing. Keyed on the callback, cancelling either would silently detach both —
	// the mock would report a teardown the browser does not perform.
	let subscriptions: Array<{ callback: () => void }> = [];

	return {
		// Resolved on read through the same validator the adapter uses, so a fault scenario reports
		// exactly what it would in a browser.
		isVisible: () => isVisibleState(rawState),

		onVisible: (callback) => {
			const subscription = { callback };
			subscriptions.push(subscription);
			return () => {
				subscriptions = subscriptions.filter((candidate) => candidate !== subscription);
			};
		},

		setVisible: (next) => {
			const nextState = next ? visibleState : hiddenState;
			const changed = nextState !== rawState;
			rawState = nextState;
			if (!changed || !next) return;
			// Snapshot for stable iteration — a subscriber may unsubscribe from inside its own
			// callback, and iterating the live array would skip the one after it. But each snapshotted
			// subscriber is re-checked against the live list before it runs, because `EventTarget`
			// does not call a listener that was removed before its turn came. Without that check the
			// mock would announce to a subscriber the real adapter would have skipped.
			const notifying = subscriptions.slice();
			for (const subscription of notifying) {
				if (subscriptions.includes(subscription)) subscription.callback();
			}
		},

		subscriberCount: () => subscriptions.length
	};
};
