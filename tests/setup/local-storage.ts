// Purpose: Provide deterministic localStorage behavior for Vitest runs.
// Why: Node may expose a partial localStorage global that does not match browser storage.
// Info flow: Test setup -> global localStorage -> adapter tests.
import { beforeEach } from 'vitest';

const createStorage = (): Storage => {
	const store = new Map<string, string>();

	return {
		get length() {
			return store.size;
		},
		clear: () => {
			store.clear();
		},
		getItem: (key: string) => store.get(key) ?? null,
		key: (index: number) => Array.from(store.keys())[index] ?? null,
		removeItem: (key: string) => {
			store.delete(key);
		},
		setItem: (key: string, value: string) => {
			store.set(key, String(value));
		}
	};
};

Object.defineProperty(globalThis, 'localStorage', {
	configurable: true,
	value: createStorage()
});

beforeEach(() => {
	localStorage.clear();
});
