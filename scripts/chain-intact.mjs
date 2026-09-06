#!/usr/bin/env node
// Purpose: Refuse to let CI's `npm run verify` mean whatever the branch under review says it means.
// Why: The verify workflow guards the committed evidence and then runs `npm run verify` — a script
//      whose definition lives in the same pull request. A change that ships no evidence folder takes
//      the "nothing to guard" path, and CI then executes that branch's own definition of the gate:
//      replace it with `true`, drop a stage from the chain, or point `test` somewhere else, and the
//      workflow reports success having verified nothing. Every check in this repository was
//      downstream of a script the change could rewrite.
// Info flow: package.json (committed bytes) -> this script -> exit 0, or a named failure and exit 1.
//
// What this does NOT check, said plainly so nobody reads more into a green run than is there:
//   * It does not run the chain. It reads the gate's DEFINITION.
//   * It does not check what the stage scripts do. A gutted `scripts/proof-tape.mjs` still satisfies
//     this; `tests/unit/` is where that is caught, and those tests run inside the chain this
//     protects. The two are deliberately in different places: a change that redefines the gate to
//     skip the tests is caught here, and a change that keeps the gate and breaks a stage is caught
//     by the tests.
//   * It hardcodes the stage list on purpose. Adding a stage to the chain must be a deliberate edit
//     in two places, which is the point: this file is the record of what the gate is supposed to
//     contain, and a check derived from the thing it checks proves nothing.
//
// Runs before `npm install` in CI, like the evidence guard and for the same reason: `npm install`
// executes this repository's `prepare` script, which is code from the branch under review.
//
// WHO IS CHECKING WHOM. This file is itself in the branch it polices, so a change that edits both it
// and `package.json` could make it approve its own hollowing-out. The workflow therefore runs the
// copy from the pull request's BASE commit when there is one, not the copy in the branch. That
// leaves one hole nothing in this repository can close: the workflow file is in the branch too, so a
// change may edit the step that runs this. Closing that needs a required status check configured on
// the repository, which is the owner's to set and not a branch's to grant itself. Said plainly here
// because a check that is vague about its own limits gets trusted for what it never did.

import { readFileSync } from 'node:fs';
import process from 'node:process';

// The chain, as the exact sequence of commands `verify` must run. Compared as a normalised command
// list rather than by substring: `includes('node scripts/chamber-lock.mjs')` is satisfied by
// `echo node scripts/chamber-lock.mjs`, which was reproduced against this file — all eight stages
// turned into echoes, every check passing, and `npm run verify` printing the names of the stages it
// no longer runs. A substring is evidence that some text is present, never that a command runs.
const REQUIRED_CHAIN = [
	'npm run audit:gate',
	'node scripts/chamber-lock.mjs',
	'node scripts/verify-runner.mjs',
	'node scripts/shaolin-lint.mjs',
	'node scripts/assumption-alarm.mjs',
	'node scripts/seam-ledger.mjs',
	'node scripts/clan-chain.mjs',
	'node scripts/proof-tape.mjs'
];

// `verify-runner.mjs` runs `npm run check` and `npm run test`, so those two scripts are part of the
// gate as surely as the stages above, and a `test` script that no longer runs the suite would take
// every unit test — including the ones that exercise the evidence guard — out of CI silently. Exact
// values for the same reason as the chain: a script that merely mentions its tool does not run it.
const REQUIRED_SCRIPTS = [
	{ name: 'test', command: 'vitest run' },
	{ name: 'check', command: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json' },
	{ name: 'lint', command: 'eslint .' },
	{ name: 'build', command: 'vite build' },
	{ name: 'audit:gate', command: 'npm audit --audit-level=high' }
];

/** A script's commands, split on `&&` and whitespace-normalised, so formatting is not a difference. */
const commandsOf = (script) =>
	script
		.split('&&')
		.map((command) => command.trim().replace(/\s+/g, ' '))
		.filter((command) => command !== '');

const problems = [];
let manifest;
try {
	manifest = JSON.parse(readFileSync('package.json', 'utf8'));
} catch (error) {
	console.error(`chain-intact: package.json could not be read as JSON (${error.message}).`);
	process.exit(1);
}

const scripts = manifest.scripts ?? {};
const verify = typeof scripts.verify === 'string' ? scripts.verify : null;

if (verify === null) {
	problems.push('package.json defines no "verify" script, so CI has no gate to run.');
} else {
	const ran = commandsOf(verify);
	const wrong = ran.length !== REQUIRED_CHAIN.length || ran.some((command, at) => command !== REQUIRED_CHAIN[at]);
	if (wrong)
		problems.push(
			`the "verify" script is not the chain. It runs:\n      ${ran.join('\n      ')}\n    and it must run, in this order:\n      ${REQUIRED_CHAIN.join('\n      ')}`
		);
	// Belt and braces on the separator: `commandsOf` splits on `&&`, so a `;` between two stages
	// would leave one "command" containing both and the comparison above would already fail. This
	// says which of the two it is, because "not the chain" and "the chain, unable to fail" are
	// different repairs.
	if (verify.includes(';'))
		problems.push(
			'the "verify" script separates commands with ";", so a failing stage does not stop the ' +
				'chain or set its exit status. The stages are chained with "&&" for that reason.'
		);
}

for (const { name, command } of REQUIRED_SCRIPTS) {
	const script = scripts[name];
	if (typeof script !== 'string') {
		problems.push(`package.json defines no "${name}" script, which the chain and the routine rely on.`);
		continue;
	}
	if (commandsOf(script).join(' && ') !== commandsOf(command).join(' && '))
		problems.push(
			`the "${name}" script is "${script}" and must be "${command}". A script that is called by ` +
				'the gate but no longer does its job leaves a green check over nothing.'
		);
}

if (problems.length > 0) {
	console.error('chain-intact: the committed definition of the verification gate is not intact.\n');
	for (const problem of problems) console.error(`  - ${problem}`);
	console.error(
		`\n${problems.length} problem${problems.length === 1 ? '' : 's'}. CI runs the branch's own ` +
			'scripts; this check is what stops the branch from deciding what "verified" means.'
	);
	process.exit(1);
}

console.log(
	`chain-intact: the verify gate runs exactly the ${REQUIRED_CHAIN.length} stages of the chain, ` +
		`and the ${REQUIRED_SCRIPTS.length} scripts it depends on are unchanged.`
);
