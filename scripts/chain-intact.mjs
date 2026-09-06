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

import { readFileSync } from 'node:fs';
import process from 'node:process';

// Each stage of the chain, by the text that invokes it. Matched as substrings of the `verify`
// script, so `node scripts/clan-chain.mjs` counts and a comment mentioning it would not — nothing
// in a package script is a comment.
const REQUIRED_STAGES = [
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
// gate as surely as the stages above. A `test` script that no longer runs the suite would take every
// unit test — including the ones that exercise the evidence guard — out of CI silently.
const REQUIRED_SCRIPTS = [
	{ name: 'test', invokes: 'vitest' },
	{ name: 'check', invokes: 'svelte-check' },
	{ name: 'lint', invokes: 'eslint' },
	{ name: 'build', invokes: 'vite build' },
	{ name: 'audit:gate', invokes: 'npm audit' }
];

// A stage that cannot fail the chain is not a stage. `;` between stages, or a trailing `|| true`,
// leaves every required substring present while the exit status stops depending on them.
const SWALLOWS_FAILURE = [' || true', ' || :', ' || exit 0'];

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
	const missing = REQUIRED_STAGES.filter((stage) => !verify.includes(stage));
	if (missing.length > 0)
		problems.push(
			`the "verify" script no longer invokes: ${missing.join(', ')}. CI runs this script as its ` +
				'only verification, so a stage removed here is a stage that stops running.'
		);
	const swallowed = SWALLOWS_FAILURE.filter((form) => verify.includes(form));
	if (swallowed.length > 0)
		problems.push(
			`the "verify" script contains ${swallowed.join(', ')}, which keeps the chain green when a ` +
				'stage fails; a stage that cannot fail the chain is not a stage.'
		);
	if (verify.includes(';'))
		problems.push(
			'the "verify" script separates commands with ";", so a failing stage does not stop the ' +
				'chain or set its exit status. The stages are chained with "&&" for that reason.'
		);
}

for (const { name, invokes } of REQUIRED_SCRIPTS) {
	const script = scripts[name];
	if (typeof script !== 'string') {
		problems.push(`package.json defines no "${name}" script, which the chain and the routine rely on.`);
		continue;
	}
	if (!script.includes(invokes))
		problems.push(
			`the "${name}" script no longer invokes ${invokes}: it is "${script}". A script that is ` +
				'called by the gate but no longer does its job leaves a green check over nothing.'
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

console.log(`chain-intact: the verify gate still invokes all ${REQUIRED_STAGES.length} stages.`);
