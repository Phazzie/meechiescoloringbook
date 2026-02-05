/*
Purpose: Probe xAI chat interpretation for ChatInterpretationSeam fixtures.
Why: Capture a real xAI-to-spec response for fixture-backed tests.
Info flow: User message -> xAI chat -> JSON spec -> fixtures/chat-interpretation/*.json.
*/
import fs from 'node:fs/promises';
import path from 'node:path';

const cwd = process.cwd();

const loadEnvFile = async () => {
	const envPath = path.join(cwd, '.env');
	try {
		const content = await fs.readFile(envPath, 'utf8');
		for (const line of content.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) {
				continue;
			}
			const idx = trimmed.indexOf('=');
			if (idx === -1) {
				continue;
			}
			const key = trimmed.slice(0, idx).trim();
			const value = trimmed.slice(idx + 1).trim();
			if (!process.env[key]) {
				process.env[key] = value;
			}
		}
	} catch (error) {
		if (error && error.code !== 'ENOENT') {
			throw error;
		}
	}
};

const requireEnv = (name) => {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required in the environment or .env file.`);
	}
	return value;
};

const SYSTEM_PROMPT = `You map user intent to a ColoringPageSpec JSON object. Output ONLY JSON.

Rules:
- Use this exact schema: {"title":string,"items":[{"number":int,"label":string}],"footerItem"?:{"number":int,"label":string},"listMode":"list"|"title_only","alignment":"left"|"center","numberAlignment":"strict"|"loose","listGutter":"tight"|"normal"|"loose","whitespaceScale":0-100,"textSize":"small"|"medium"|"large","fontStyle":"rounded"|"block"|"hand","textStrokeWidth":4-12,"colorMode":"black_and_white_only"|"grayscale"|"color","decorations":"none"|"minimal"|"dense","illustrations":"none"|"simple"|"scene","shading":"none"|"hatch"|"stippling","border":"none"|"plain"|"decorative","borderThickness":2-16,"variations":1-4,"outputFormat":"png"|"pdf","pageSize":"US_Letter"|"A4"}.
- items: 1-20 items, numbers 1-999, labels 1-40 chars.
- Allowed label characters: letters, numbers, spaces, and .,!?'":;-() only.
- If user intent is vague, choose a short title and 2 list items.
- Default values when unspecified: listMode="list", alignment="left", numberAlignment="strict", listGutter="normal", whitespaceScale=50, textSize="small", fontStyle="rounded", textStrokeWidth=6, colorMode="black_and_white_only", decorations="none", illustrations="none", shading="none", border="plain", borderThickness=8, variations=1, outputFormat="pdf", pageSize="US_Letter".
- Output JSON only. No markdown, no prose.`;

const extractJson = (content) => {
	const start = content.indexOf('{');
	const end = content.lastIndexOf('}');
	if (start === -1 || end === -1 || end <= start) {
		return null;
	}
	return content.slice(start, end + 1);
};

const readJson = async (response) => {
	const text = await response.text();
	if (!text) {
		return { ok: false, value: null, raw: '' };
	}
	try {
		return { ok: true, value: JSON.parse(text), raw: text };
	} catch {
		return { ok: false, value: null, raw: text };
	}
};

const writeFixture = async (name, value) => {
	const target = path.join(cwd, 'fixtures', 'chat-interpretation', name);
	await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const run = async () => {
	await loadEnvFile();
	const apiKey = requireEnv('XAI_API_KEY');
	const baseUrl = process.env.XAI_BASE_URL || 'https://api.x.ai';

	const message = 'Make a checklist about growth';
	const response = await fetch(`${baseUrl}/v1/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: 'grok-4-1-fast-reasoning',
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content: message }
			]
		})
	});

	const payload = await readJson(response);
	if (!response.ok) {
		throw new Error(payload?.value?.error?.message || response.statusText);
	}

	const content = payload?.value?.choices?.[0]?.message?.content || '';
	const extracted = extractJson(content);
	if (!extracted) {
		throw new Error('Chat response did not contain JSON.');
	}
	const spec = JSON.parse(extracted);

	await writeFixture('sample.json', {
		scenario: 'sample',
		input: { message },
		output: {
			ok: true,
			value: { spec }
		}
	});

	await writeFixture('fault.json', {
		scenario: 'fault',
		input: { message: '??' },
		output: {
			ok: false,
			error: {
				code: 'CHAT_INPUT_INVALID',
				message: 'Chat message is too short or invalid.'
			}
		}
	});

	console.log('Chat interpretation probe complete.');
	console.log(`Title: ${spec.title}`);
	console.log(`Items: ${Array.isArray(spec.items) ? spec.items.length : 0}`);
};

run().catch((error) => {
	console.error('Chat interpretation probe failed.');
	console.error(error?.message || error);
	process.exit(1);
});
