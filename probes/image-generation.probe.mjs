/*
Purpose: Probe xAI image generation for ImageGenerationSeam.
Why: Verify real xAI API behavior and print output in the new seam contract shape
     (ImageGenerationResult: { images, rawModelInfo, timingMs }) so developers can
     manually update src/lib/seams/image-generation-seam/fixtures.ts if the response
     shape changes.
Info flow: ImageGenerationRequest -> xAI API -> console (new contract format).
Note: This probe no longer writes JSON fixture files; the new seam uses in-module
      fixtures at src/lib/seams/image-generation-seam/fixtures.ts.
*/
import path from 'node:path';
import fs from 'node:fs/promises';

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

const run = async () => {
	await loadEnvFile();
	const apiKey = requireEnv('XAI_API_KEY');
	const baseUrl = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
	const imageModel = process.env.XAI_IMAGE_MODEL || 'grok-2-image';
	const imageEndpointPath = process.env.XAI_IMAGE_ENDPOINT_PATH || '/images/generations';

	const request = {
		prompt: 'a glam kitten wearing a bow',
		negativePrompt: 'color, shading, gradient',
		n: 1,
		size: '1024x1024',
		format: 'url'
	};

	const url = new URL(
		imageEndpointPath.startsWith('/') ? imageEndpointPath.slice(1) : imageEndpointPath,
		baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
	).toString();

	const start = Date.now();
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: imageModel,
			prompt: request.negativePrompt
				? `${request.prompt}\n\nNegative prompt: ${request.negativePrompt}`
				: request.prompt,
			n: request.n,
			response_format: request.format
		})
	});

	const timingMs = Date.now() - start;

	if (!response.ok) {
		const text = await response.text().catch(() => '');
		throw new Error(`xAI returned ${response.status}${text ? `: ${text}` : ''}`);
	}

	const payload = await response.json();
	const data = Array.isArray(payload?.data) ? payload.data : [];

	const images = data.map((item, index) => ({
		id: `xai-${index + 1}`,
		url: item.url,
		b64: item.b64_json
	}));

	const result = {
		images,
		rawModelInfo: {
			model: imageModel,
			revisedPrompt: data[0]?.revised_prompt,
			requestedSize: request.size,
			responseFormat: request.format
		},
		timingMs
	};

	console.log('Image generation probe complete.');
	console.log(`Image count: ${images.length}`);
	console.log('Result (new seam contract shape):');
	console.log(JSON.stringify(result, null, 2));
	console.log('');
	console.log(
		'If the response shape changed, update src/lib/seams/image-generation-seam/fixtures.ts manually.'
	);
};

run().catch((error) => {
	console.error('Image generation probe failed.');
	console.error(error?.message || error);
	process.exit(1);
});
