/*
Purpose: Probe browser-only seams (Session, AuthContext, CreationStore) using a real browser.
Why: Capture localStorage and session behavior in a real browser environment for fixtures.
Info flow: Browser APIs -> seam outputs -> fixtures/*.json updates.
*/
import http from 'node:http';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright';

const cwd = process.cwd();

const readJson = async (filePath) => {
	const raw = await fs.readFile(filePath, 'utf8');
	return JSON.parse(raw);
};

const writeFixture = async (seam, name, value) => {
	const target = path.join(cwd, 'fixtures', seam, name);
	await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const startServer = async () => {
	const server = http.createServer((request, response) => {
		response.writeHead(200, { 'Content-Type': 'text/html' });
		response.end('<!doctype html><title>browser-seam-probe</title>');
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') {
		throw new Error('Probe server did not return a port.');
	}
	return { server, port: address.port };
};

const runSessionProbe = async (page) =>
	page.evaluate(() => {
		const SESSION_KEY = 'cb_session_id_v1';
		localStorage.clear();
		localStorage.setItem(SESSION_KEY, 'session-123');
		const sessionId = localStorage.getItem(SESSION_KEY) || '';
		return {
			scenario: 'sample',
			input: {},
			output: {
				ok: true,
				value: { sessionId }
			}
		};
	});

const runAuthContextProbe = async (page) =>
	page.evaluate(() => {
		const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
		const input = { sessionId: 'session-123' };
		if (input.sessionId && !SESSION_ID_PATTERN.test(input.sessionId)) {
			return {
				scenario: 'sample',
				input,
				output: {
					ok: false,
					error: {
						code: 'SESSION_ID_INVALID',
						message: 'Session ID contains invalid characters.'
					}
				}
			};
		}
		return {
			scenario: 'sample',
			input,
			output: {
				ok: true,
				value: {
					kind: 'anonymous',
					capabilities: ['generate', 'store'],
					rateLimitTier: 'anonymous'
				}
			}
		};
	});

const runCreationStoreProbe = async (page, input) =>
	page.evaluate((probeInput) => {
		const CREATIONS_KEY = 'cb_creations_v1';
		const DRAFT_KEY = 'cb_drafts_v1';
		const MAX_CREATIONS = 50;

		const readRecords = () => {
			const raw = localStorage.getItem(CREATIONS_KEY);
			if (!raw) {
				return [];
			}
			try {
				const parsed = JSON.parse(raw);
				return Array.isArray(parsed) ? parsed : [];
			} catch {
				return [];
			}
		};

		const writeRecords = (records) => {
			localStorage.setItem(CREATIONS_KEY, JSON.stringify(records));
		};

		const ownerMatches = (record, owner) => {
			if (record.owner?.kind === 'anonymous' && owner.kind === 'anonymous') {
				return record.owner.sessionId === owner.sessionId;
			}
			if (record.owner?.kind === 'authenticated' && owner.kind === 'authenticated') {
				return record.owner.userId === owner.userId;
			}
			return false;
		};

		localStorage.clear();

		const saveCreation = () => {
			const record = probeInput.saveCreation.record;
			const records = readRecords();
			const filtered = records.filter((existing) => existing.id !== record.id);
			const next = [record, ...filtered].slice(0, MAX_CREATIONS);
			writeRecords(next);
			return { ok: true, value: record };
		};

		const listCreations = () => {
			const records = readRecords();
			const owner = probeInput.listCreations.owner;
			const filtered = records.filter((record) => ownerMatches(record, owner));
			return { ok: true, value: filtered };
		};

		const getCreation = () => {
			const records = readRecords();
			const found = records.find((record) => record.id === probeInput.getCreation.id) || null;
			return { ok: true, value: found };
		};

		const deleteCreation = () => {
			const records = readRecords();
			const beforeCount = records.length;
			const filtered = records.filter((record) => record.id !== probeInput.deleteCreation.id);
			writeRecords(filtered);
			return { ok: true, value: filtered.length < beforeCount };
		};

		const saveDraft = () => {
			localStorage.setItem(DRAFT_KEY, JSON.stringify(probeInput.saveDraft.draft));
			return { ok: true, value: probeInput.saveDraft.draft };
		};

		const getDraft = () => {
			const raw = localStorage.getItem(DRAFT_KEY);
			if (!raw) {
				return { ok: true, value: null };
			}
			try {
				return { ok: true, value: JSON.parse(raw) };
			} catch {
				return { ok: true, value: null };
			}
		};

		const clearDraft = () => {
			localStorage.setItem(DRAFT_KEY, JSON.stringify(null));
			return { ok: true, value: true };
		};

		return {
			saveCreation: saveCreation(),
			listCreations: listCreations(),
			getCreation: getCreation(),
			deleteCreation: deleteCreation(),
			saveDraft: saveDraft(),
			getDraft: getDraft(),
			clearDraft: clearDraft()
		};
	}, input);

const run = async () => {
	const creationFixture = await readJson(
		path.join(cwd, 'fixtures', 'creation-store', 'sample.json')
	);
	const creationInput = creationFixture.input;

	const { server, port } = await startServer();
	const browser = await chromium.launch();

	try {
		const context = await browser.newContext();
		const page = await context.newPage();
		await page.goto(`http://127.0.0.1:${port}`);

		const sessionSample = await runSessionProbe(page);
		const authSample = await runAuthContextProbe(page);
		const creationOutput = await runCreationStoreProbe(page, creationInput);

		await writeFixture('session', 'sample.json', sessionSample);
		await writeFixture('auth-context', 'sample.json', authSample);
		await writeFixture('creation-store', 'sample.json', {
			scenario: 'sample',
			input: creationInput,
			output: creationOutput
		});

		console.log('Browser seam probe complete.');
		console.log(`Session id: ${sessionSample.output.value.sessionId}`);
		console.log(`Auth kind: ${authSample.output.value.kind}`);
		console.log(`Creation count: ${creationOutput.listCreations.value.length}`);
	} finally {
		await browser.close();
		await new Promise((resolve) => server.close(resolve));
	}
};

run().catch((error) => {
	console.error('Browser seam probe failed.');
	console.error(error?.message || error);
	process.exit(1);
});
