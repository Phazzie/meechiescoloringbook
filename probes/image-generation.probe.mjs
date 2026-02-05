/*
Purpose: Probe xAI image generation for ImageGenerationSeam fixtures.
Why: Capture real base64 image output mapped to GeneratedImage contracts.
Info flow: Spec + prompt -> xAI image -> fixtures/image-generation/*.json.
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
	const target = path.join(cwd, 'fixtures', 'image-generation', name);
	await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const run = async () => {
	await loadEnvFile();
	const apiKey = requireEnv('XAI_API_KEY');
	const baseUrl = process.env.XAI_BASE_URL || 'https://api.x.ai';

	const spec = {
		title: 'Dream Big',
		items: [
			{ number: 1, label: 'Shine' },
			{ number: 2, label: 'Grow' }
		],
		footerItem: { number: 97, label: 'YOU' },
		dedication: 'Jade',
		listMode: 'list',
		alignment: 'left',
		numberAlignment: 'strict',
		listGutter: 'normal',
		whitespaceScale: 50,
		textSize: 'small',
		fontStyle: 'rounded',
		textStrokeWidth: 6,
		colorMode: 'black_and_white_only',
		decorations: 'none',
		illustrations: 'none',
		shading: 'none',
		border: 'plain',
		borderThickness: 8,
		variations: 1,
		outputFormat: 'pdf',
		pageSize: 'US_Letter'
	};

	const prompt = `Black-and-white coloring book page for print.
STYLE:
[Describe the vibe. Include outline-only and easy to color.]
Vibe: glam icons outline-only, easy to color. Color: black and white only.
TEXT (exact):
[Main quote EXACT — do not alter text.]
Dream Big
[Secondary line EXACT — omit if none.]
YOU
TYPOGRAPHY:
Bold bubble letters; thick outlines.
Glitter outline only (no shading).
Font: rounded. Stroke: 6px.
LAYOUT:
US Letter 8.5x11 portrait. Left-align the quote. Line 1 headline; line 2 below.
Keep generous whitespace; treat blank space intentional.
List items: 1. Shine; 2. Grow (Gutter: normal).
all numbers vertically aligned; all text left-aligned; treat blank space as intentional; do not fill empty space.
Add dedication: "Dedicated to Jade".
DECORATIONS:
Decorations: none. Illustrations: none. Shading: none. Border: plain 8px.
OUTPUT:
Crisp vector-like linework. Black outlines on white. Printable.
NEGATIVE PROMPT:
no color
no grayscale
no shading
no gradients
no filled shapes
no extra words`;

	const response = await fetch(`${baseUrl}/v1/images/generations`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: 'grok-2-image-1212',
			prompt,
			n: 1,
			response_format: 'b64_json'
		})
	});

	const payload = await readJson(response);
	if (!response.ok) {
		const raw = payload?.raw ? payload.raw.trim() : '';
		const message =
			raw ||
			payload?.value?.error?.message ||
			payload?.value?.message ||
			response.statusText ||
			'Image request failed.';
		throw new Error(`${response.status} ${message}`.trim());
	}

	const data = Array.isArray(payload?.value?.data) ? payload.value.data : [];
	const revisedPrompt =
		payload?.value?.revised_prompt ||
		payload?.value?.revisedPrompt ||
		data.find((entry) => typeof entry?.revised_prompt === 'string')?.revised_prompt;

	const images = data
		.map((entry, index) => {
			if (typeof entry?.b64_json !== 'string') {
				return null;
			}
			return {
				id: `image-${index + 1}`,
				format: 'png',
				mimeType: 'image/png',
				data: entry.b64_json,
				encoding: 'base64'
			};
		})
		.filter((entry) => entry !== null);

	await writeFixture('sample.json', {
		scenario: 'sample',
		input: {
			spec,
			prompt,
			variations: 1,
			outputFormat: 'pdf'
		},
		output: {
			ok: true,
			value: {
				images,
				revisedPrompt,
				modelMetadata: {
					provider: 'xai',
					model: 'grok-2-image-1212'
				}
			}
		}
	});

	await writeFixture('fault.json', {
		scenario: 'fault',
		input: {
			spec: {
				title: 'Dream Big',
				items: [{ number: 1, label: 'Shine' }],
				listMode: 'list',
				alignment: 'left',
				numberAlignment: 'strict',
				listGutter: 'normal',
				whitespaceScale: 50,
				textSize: 'small',
				fontStyle: 'rounded',
				textStrokeWidth: 6,
				colorMode: 'black_and_white_only',
				decorations: 'none',
				illustrations: 'none',
				shading: 'none',
				border: 'plain',
				borderThickness: 8,
				variations: 1,
				outputFormat: 'pdf',
				pageSize: 'US_Letter'
			},
			prompt: 'A dreamy coloring page with gradients.',
			variations: 1,
			outputFormat: 'pdf'
		},
		output: {
			ok: false,
			error: {
				code: 'PROMPT_MISSING_REQUIRED_PHRASES',
				message: 'Prompt missing required phrases for deterministic generation.'
			}
		}
	});

	console.log('Image generation probe complete.');
	console.log(`Image count: ${images.length}`);
	console.log(`First image base64 length: ${images[0]?.data?.length || 0}`);
};

run().catch((error) => {
	console.error('Image generation probe failed.');
	console.error(error?.message || error);
	process.exit(1);
});
