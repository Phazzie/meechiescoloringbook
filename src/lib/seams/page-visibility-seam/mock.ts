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
	// Runs the fixture through the same validator the adapter uses, so a fault scenario resolves
	// here exactly as it would in a browser.
	let visible = isVisibleState(RAW_STATES[scenario]);
	let subscribers: Array<() => void> = [];

	return {
		isVisible: () => visible,

		onVisible: (callback) => {
			subscribers.push(callback);
			return () => {
				subscribers = subscribers.filter((candidate) => candidate !== callback);
			};
		},

		setVisible: (next) => {
			const becameVisible = next && !visible;
			visible = next;
			if (!becameVisible) return;
			// Snapshot for stable iteration — a subscriber may unsubscribe from inside its own
			// callback, and iterating the live array would skip the one after it. But each snapshotted
			// subscriber is re-checked against the live list before it runs, because `EventTarget`
			// does not call a listener that was removed before its turn came. Without that check the
			// mock would announce to a subscriber the real adapter would have skipped.
			const notifying = subscribers.slice();
			for (const subscriber of notifying) {
				if (subscribers.includes(subscriber)) subscriber();
			}
		},

		subscriberCount: () => subscribers.length
	};
};
