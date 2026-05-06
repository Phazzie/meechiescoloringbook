import { describe, expect, it } from 'vitest';
import { MeechieToolIdSchema } from '../../contracts/meechie-tool.contract';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Meechie Tools Parity', () => {
	it('ensures all tools in the contract are present in the UI component', () => {
		const svelteFile = readFileSync(resolve(__dirname, '../../src/lib/components/MeechieTools.svelte'), 'utf-8');
		const contractTools = MeechieToolIdSchema.options;

		for (const tool of contractTools) {
			const toolIdPattern = new RegExp(`id: '${tool}'`);
			expect(svelteFile).toMatch(toolIdPattern);
		}
	});

    it('ensures payload generation exists for all tools', () => {
		const svelteFile = readFileSync(resolve(__dirname, '../../src/lib/components/MeechieTools.svelte'), 'utf-8');
		const contractTools = MeechieToolIdSchema.options;

		for (const tool of contractTools) {
			const toolCasePattern = new RegExp(`case '${tool}':`);
			expect(svelteFile).toMatch(toolCasePattern);
		}
	});
});
