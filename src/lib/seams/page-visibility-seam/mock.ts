// Purpose: A PageVisibilitySeam whose visibility only changes when a test changes it.
// Why: "The reader came back to the tab" is a transition, and a unit test cannot produce a real
//      one. `setVisible` produces it directly and announces it to subscribers.
// Info flow: test -> createMockPageVisibilitySeam().setVisible(true) -> subscribers run.
import type { PageVisibilitySeam } from './contract';
import { isVisibleState } from './validators';

export type MockPageVisibilitySeam = PageVisibilitySeam & {
	/** Change visibility. Announces only on a hidden -> visible transition, as the browser does. */
	setVisible(visible: boolean): void;
	/** How many subscribers are still attached. Proves teardown actually detached them. */
	subscriberCount(): number;
};

export const createMockPageVisibilitySeam = (
	initialState: unknown = 'visible'
): MockPageVisibilitySeam => {
	// Runs the fixture through the same validator the adapter uses, so a fault state resolves here
	// exactly as it would in a browser.
	let visible = isVisibleState(initialState);
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
			// Snapshot before notifying: a subscriber is free to unsubscribe from inside its own
			// callback, which reassigns `subscribers`, and iterating the live array would then skip
			// the next one. `slice()` rather than a spread so the copy reads as deliberate.
			const notifying = subscribers.slice();
			for (const subscriber of notifying) subscriber();
		},

		subscriberCount: () => subscribers.length
	};
};
