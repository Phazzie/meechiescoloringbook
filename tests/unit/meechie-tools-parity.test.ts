// Purpose: Verify the embedded Meechie tools UI exposes every contract tool.
// Why: Prevent adding a tool to the seam contract without a matching UI path.
// Info flow: Contract tool ids + Svelte source -> parity assertions.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MeechieToolIdSchema } from '../../contracts/meechie-tool.contract';

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
	resolve(currentDir, '../../src/lib/components/MeechieTools.svelte'),
	'utf8'
);

describe('Meechie tools UI parity', () => {
	it('lists every contract tool in the picker', () => {
		for (const tool of MeechieToolIdSchema.options) {
			expect(source).toMatch(new RegExp(`id: '${tool}'`));
		}
	});

	it('builds request payloads for every contract tool', () => {
		for (const tool of MeechieToolIdSchema.options) {
			expect(source).toMatch(new RegExp(`case '${tool}':`));
		}
	});
});
