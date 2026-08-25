/*
 * Purpose: Prove the documented live-provider probes run under plain Node and fail truthfully.
 * Why: Node 20 cannot import TypeScript directly, and a failed or empty provider response must
 *      never exit zero or overwrite the last known-good fixtures.
 * Info flow: child Node process -> local HTTP stub -> probe exit/output/fixture assertions.
 */
import { spawn, spawnSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync
} from 'node:fs';
import {
	createServer,
	type IncomingMessage,
	type RequestListener,
	type ServerResponse
} from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const temporaryDirectories: string[] = [];

const makeTemporaryDirectory = () => {
	const directory = mkdtempSync(
		path.join(tmpdir(), 'meechie-probe-entrypoint-')
	);
	temporaryDirectories.push(directory);
	return directory;
};

const runProbe = (
	probe: string,
	cwd: string,
	env: Record<string, string>
): Promise<{ status: number | null; stdout: string; stderr: string }> =>
	new Promise((resolve, reject) => {
		const child = spawn(
			process.execPath,
			[path.join(repoRoot, 'probes', probe)],
			{
				cwd,
				env: { ...process.env, ...env }
			}
		);
		let stdout = '';
		let stderr = '';
		child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk));
		child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));
		child.on('error', reject);
		child.on('close', (status) => resolve({ status, stdout, stderr }));
	});

const withStubProvider = async (
	handler: RequestListener,
	run: (baseUrl: string) => Promise<void>
) => {
	const server = createServer(handler);
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => resolve());
	});
	const address = server.address();
	if (!address || typeof address === 'string')
		throw new Error('Stub provider did not bind.');
	try {
		await run(`http://127.0.0.1:${address.port}`);
	} finally {
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve()))
		);
	}
};

const respondJson = (
	response: ServerResponse<IncomingMessage>,
	status: number,
	payload: unknown
) => {
	response.writeHead(status, { 'Content-Type': 'application/json' });
	response.end(JSON.stringify(payload));
};

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe.each(['provider-adapter.probe.mjs', 'chat-interpretation.probe.mjs'])(
	'%s',
	(probe) => {
		it('loads with plain Node and reaches the credential guard', () => {
			const result = spawnSync(
				process.execPath,
				[path.join(repoRoot, 'probes', probe)],
				{
					cwd: makeTemporaryDirectory(),
					encoding: 'utf8',
					env: { ...process.env, XAI_API_KEY: '' }
				}
			);

			expect(result.status).toBe(1);
			expect(result.stderr).toContain(
				'XAI_API_KEY is required in the environment or .env file.'
			);
			expect(result.stderr).not.toContain('Unknown file extension');
			expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
		});
	}
);

describe('provider-adapter probe truthfulness', () => {
	it.each([
		{
			name: 'HTTP failures',
			chat: { status: 400, payload: { error: 'retired model' } },
			image: { status: 429, payload: { error: { message: 'quota exceeded' } } },
			expected: ['PROVIDER_HTTP_ERROR', 'retired model', 'quota exceeded']
		},
		{
			name: 'empty successful payloads',
			chat: { status: 200, payload: { choices: [] } },
			image: { status: 200, payload: { data: [] } },
			expected: ['PROVIDER_EMPTY_CHAT', 'PROVIDER_EMPTY_IMAGE']
		}
	])(
		'exits nonzero and preserves fixtures for $name',
		async ({ chat, image, expected }) => {
			await withStubProvider(
				(request, response) => {
					if (request.url?.includes('/chat/completions')) {
						respondJson(response, chat.status, chat.payload);
						return;
					}
					respondJson(response, image.status, image.payload);
				},
				async (baseUrl) => {
					const cwd = makeTemporaryDirectory();
					const result = await runProbe('provider-adapter.probe.mjs', cwd, {
						XAI_API_KEY: 'test-key',
						XAI_BASE_URL: baseUrl
					});

					expect(result.status).toBe(1);
					expect(result.stderr).toContain('Live sample validation failed');
					for (const fragment of expected)
						expect(result.stderr).toContain(fragment);
					expect(
						existsSync(path.join(cwd, 'fixtures/provider-adapter/sample.json'))
					).toBe(false);
				}
			);
		}
	);

	it('writes fixtures and exits zero only after sample and fault validations pass', async () => {
		let chatCalls = 0;
		let imageCalls = 0;
		await withStubProvider(
			(request, response) => {
				if (request.url?.includes('/chat/completions')) {
					chatCalls += 1;
					respondJson(
						response,
						chatCalls === 1 ? 200 : 400,
						chatCalls === 1
							? {
									model: 'grok-4.6',
									choices: [{ message: { content: '{"status":"OK"}' } }]
								}
							: {
									error:
										'bad text model for team 3b93d791-c9bb-49e5-a6f7-da40d956241a'
								}
					);
					return;
				}
				imageCalls += 1;
				respondJson(
					response,
					imageCalls === 1 ? 200 : 400,
					imageCalls === 1
						? { data: [{ b64_json: 'image-bytes' }] }
						: { error: 'bad image model for key sk-1234567890abcdefghijkl' }
				);
			},
			async (baseUrl) => {
				const cwd = makeTemporaryDirectory();
				mkdirSync(path.join(cwd, 'fixtures/provider-adapter'), {
					recursive: true
				});
				const result = await runProbe('provider-adapter.probe.mjs', cwd, {
					XAI_API_KEY: 'test-key',
					XAI_BASE_URL: baseUrl
				});

				expect(result.status).toBe(0);
				expect(result.stdout).toContain('Provider probe complete');
				const sample = JSON.parse(
					readFileSync(
						path.join(cwd, 'fixtures/provider-adapter/sample.json'),
						'utf8'
					)
				);
				const fault = JSON.parse(
					readFileSync(
						path.join(cwd, 'fixtures/provider-adapter/fault.json'),
						'utf8'
					)
				);
				expect(sample.input.chat.model).toBe('grok-4.6');
				expect(sample.output.chat.ok).toBe(true);
				expect(sample.output.image.ok).toBe(true);
				expect(fault.output.chat).toMatchObject({
					ok: false,
					error: { code: 'PROVIDER_HTTP_ERROR' }
				});
				expect(fault.output.image).toMatchObject({
					ok: false,
					error: { code: 'PROVIDER_HTTP_ERROR' }
				});
				const serializedFault = JSON.stringify(fault);
				expect(serializedFault).toContain('[redacted-id]');
				expect(serializedFault).toContain('[redacted-key]');
				expect(serializedFault).not.toContain(
					'3b93d791-c9bb-49e5-a6f7-da40d956241a'
				);
				expect(serializedFault).not.toContain('sk-1234567890abcdefghijkl');
			}
		);
	});
});
