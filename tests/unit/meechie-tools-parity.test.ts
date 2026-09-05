// Purpose: Verify parity between Meechie tool definitions and their implementations.
// Why: Prevents tool definitions from drifting out of sync with available tools.
// Info flow: Tool registry -> parity assertions -> test pass/fail.
import { describe, expect, it } from 'vitest';
import { MeechieToolIdSchema as legacyMeechieToolIdSchema } from '../../contracts/meechie-tool.contract';
import { MeechieToolIdSchema } from '../../src/lib/seams/meechie-tool-seam/contract';
import { meechieToolAdapter as legacyMeechieToolAdapter } from '../../src/lib/adapters/meechie-tool.adapter';
import { meechieToolAdapter } from '../../src/lib/adapters/meechie-tool-seam';
import { createMeechieToolMock as createLegacyMeechieToolMock } from '../../src/lib/mocks/meechie-tool.mock';
import { createMeechieToolMock } from '../../src/lib/seams/meechie-tool-seam/mock';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Meechie Tools Parity', () => {
	it('routes compatibility imports to the canonical production seam', () => {
		expect(legacyMeechieToolIdSchema).toBe(MeechieToolIdSchema);
		expect(legacyMeechieToolAdapter).toBe(meechieToolAdapter);
		expect(createLegacyMeechieToolMock).toBe(createMeechieToolMock);
		expect(MeechieToolIdSchema.options).toHaveLength(11);
	});

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

	// Every tool in this hub used to dead-end at a paragraph of text, which in a coloring book
	// app is the product missing. The page factory is the fix; this asserts it stays wired, since
	// the tools themselves would keep passing every check above without it.
	it('keeps the coloring page factory wired to the toolkit', () => {
		const svelteFile = readFileSync(
			resolve(__dirname, '../../src/lib/components/MeechieTools.svelte'),
			'utf-8'
		).replaceAll('\r\n', '\n');

		expect(svelteFile).toContain('buildToolPageRecipe');
		expect(svelteFile).toContain("postJson(\n\t\t\t\t'/api/generate'");
		for (const testId of [
			'meechie-tool-page-factory',
			'meechie-tool-make-page',
			'meechie-tool-download',
			'meechie-tool-save-vault',
			'meechie-tool-copy'
		]) {
			expect(svelteFile).toContain(testId);
		}
	});
});
