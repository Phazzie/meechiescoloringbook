// Purpose: Covers which entry the Cipher Gate validates and which evidence the Proof Tape
//          marks as belonging to an earlier run.
// Why: Both gates reported success while describing the wrong thing — the gate certified an
//      older same-date Cipher Gate entry, and the tape listed a stale transcript beside a
//      fresh one without distinguishing them. A green run must mean what it appears to mean.
// Info flow: DECISIONS.md blocks / evidence file stats -> selection helpers -> gate reports.
import { describe, expect, test } from 'vitest';

import {
	parseCipherBlocks,
	selectLatestCipherBlock
} from '../../scripts/cipher-gate.mjs';
import {
	markArtifactsPredatingRun,
	renderProofTapeLines
} from '../../scripts/proof-tape.mjs';

const cipherBlock = (date: string, summary: string) =>
	[
		'- Cipher Gate:',
		`  - Date: ${date}`,
		'  - Seams: SomeSeam',
		'  - Evidence: docs/evidence/x.txt',
		`  - Summary: ${summary}`,
		'  - Risks: None'
	].join('\n');

describe('Cipher Gate entry selection', () => {
	test('picks the newest entry when two share a date', () => {
		// DECISIONS.md is newest-first, so the newer entry appears earlier in the file.
		const decisions = [
			'# Decisions',
			'',
			cipherBlock('2026-09-03', 'the newer entry'),
			'',
			cipherBlock('2026-09-03', 'the older entry'),
			''
		].join('\n');

		const latest = selectLatestCipherBlock(parseCipherBlocks(decisions));

		expect(latest?.summary).toBe('the newer entry');
	});

	test('picks the newest date regardless of document position', () => {
		const decisions = [
			cipherBlock('2026-08-26', 'older date, listed first'),
			'',
			cipherBlock('2026-09-03', 'newer date, listed second')
		].join('\n');

		expect(selectLatestCipherBlock(parseCipherBlocks(decisions))?.summary).toBe(
			'newer date, listed second'
		);
	});

	test('still resolves a single entry, and reports none when no date parses', () => {
		expect(
			selectLatestCipherBlock(
				parseCipherBlocks(cipherBlock('2026-09-03', 'only'))
			)?.summary
		).toBe('only');
		expect(
			selectLatestCipherBlock(
				parseCipherBlocks(cipherBlock('not-a-date', 'bad'))
			)
		).toBeNull();
		expect(selectLatestCipherBlock([])).toBeNull();
	});

	test('records document position so equal dates can be ordered at all', () => {
		const blocks = parseCipherBlocks(
			[
				cipherBlock('2026-09-03', 'first'),
				'',
				cipherBlock('2026-09-03', 'second')
			].join('\n')
		);

		expect(blocks).toHaveLength(2);
		expect(blocks[0].position).toBeLessThan(blocks[1].position);
	});
});

describe('Proof Tape staleness marking', () => {
	const file = (name: string, modifiedAt: string) => ({
		name,
		path: `docs/evidence/2026-09-03/${name}`,
		sizeBytes: 10,
		modifiedAt,
		commands: []
	});

	test('marks an artifact older than this run’s chamber-lock.json', () => {
		const marked = markArtifactsPredatingRun([
			file('chamber-lock.json', '2026-09-03T09:07:00.000Z'),
			file('verify.txt', '2026-09-03T09:08:00.000Z'),
			file('test.txt', '2026-09-03T09:08:30.000Z'),
			file('verify-chain.txt', '2026-09-03T05:10:00.000Z')
		]);

		const byName = Object.fromEntries(
			marked.map((entry) => [entry.name, entry.predatesRun])
		);
		expect(byName['verify-chain.txt']).toBe(true);
		expect(byName['test.txt']).toBe(false);
		expect(byName['verify.txt']).toBe(false);
	});

	test('counts the whole chain as this run, including stages before verify-runner', () => {
		// chamber-lock runs first, then verify-runner (~a minute later), then the rest. All of
		// them belong to the run; marking against verify.txt would flag chamber-lock's own file.
		const marked = markArtifactsPredatingRun([
			file('chamber-lock.json', '2026-09-03T09:07:00.000Z'),
			file('verify.txt', '2026-09-03T09:08:00.000Z'),
			file('seam-ledger.json', '2026-09-03T09:09:10.000Z')
		]);

		expect(marked.every((entry) => entry.predatesRun === false)).toBe(true);
	});

	test('reports unknown rather than guessing when there is no run marker', () => {
		const marked = markArtifactsPredatingRun([
			file('verify-chain.txt', '2026-09-03T05:10:00.000Z')
		]);

		expect(marked[0].predatesRun).toBeNull();
	});

	test('reports unknown for an unparseable timestamp instead of calling it fresh', () => {
		const marked = markArtifactsPredatingRun([
			file('chamber-lock.json', '2026-09-03T09:07:00.000Z'),
			file('mystery.txt', 'not a timestamp')
		]);

		expect(
			marked.find((entry) => entry.name === 'mystery.txt')?.predatesRun
		).toBeNull();
	});
});

describe('Proof Tape markdown freshness wording', () => {
	const report = {
		generatedAt: '2026-09-03T10:00:00.000Z',
		evidenceDir: 'docs/evidence/2026-09-03'
	};
	const marked = (name: string, predatesRun: boolean | null) => ({
		name,
		path: `docs/evidence/2026-09-03/${name}`,
		sizeBytes: 10,
		modifiedAt: '2026-09-03T09:00:00.000Z',
		commands: [],
		predatesRun
	});

	test('says so in prose when a file predates the run, not just in the JSON', () => {
		const text = renderProofTapeLines(report, [
			marked('verify.txt', false),
			marked('verify-chain.txt', true)
		]).join('\n');

		expect(text).toContain(
			'verify-chain.txt (10 bytes) — PREDATES THIS VERIFY RUN'
		);
		expect(text).toContain(
			"Older than this run's chamber-lock.json: verify-chain.txt."
		);
	});

	test('warns when freshness is unknown, instead of reading like everything is current', () => {
		// No chamber-lock.json in the folder: predatesRun is null for every file. Previously
		// this rendered identically to the all-fresh case — the JSON said unknown and the
		// Markdown, the half a non-coder reads, said nothing at all.
		const text = renderProofTapeLines(report, [
			marked('verify.txt', null),
			marked('test.txt', null)
		]).join('\n');

		expect(text).toContain('— FRESHNESS UNKNOWN');
		expect(text).toContain('No chamber-lock.json in this folder');
		expect(text).not.toContain('PREDATES THIS VERIFY RUN');
	});

	test('stays quiet when every file belongs to the run', () => {
		const text = renderProofTapeLines(report, [
			marked('chamber-lock.json', false),
			marked('verify.txt', false)
		]).join('\n');

		expect(text).not.toContain('PREDATES THIS VERIFY RUN');
		expect(text).not.toContain('FRESHNESS UNKNOWN');
		expect(text).not.toContain('No chamber-lock.json');
	});

	test('never lists its own outputs, which it overwrites after taking the inventory', () => {
		const text = renderProofTapeLines(report, [
			marked('verify.txt', false)
		]).join('\n');

		expect(text).toContain('are written');
		expect(text).not.toContain('- proof-tape.json (');
		expect(text).not.toContain('- proof-tape.md (');
	});
});
