/*
Purpose: Probe the xAI provider endpoints for ProviderAdapterSeam fixtures.
Why: Capture real responses for chat and image generation to back mocks/tests.
Info flow: xAI responses -> normalized seam outputs -> fixtures/provider-adapter/*.json.
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
	} catch (error) {
		return { ok: false, value: null, raw: text };
	}
};

const buildError = (response, payload) => {
	const message =
		payload?.error?.message ||
		payload?.message ||
		response.statusText ||
		`Request failed with status ${response.status}`;
	return {
		ok: false,
		error: {
			code: 'PROVIDER_HTTP_ERROR',
			message,
			details: {
				status: String(response.status)
			}
		}
	};
};

const normalizeChatOutput = (payload, fallbackModel) => {
	const content =
		payload?.choices?.[0]?.message?.content ||
		payload?.choices?.[0]?.text ||
		'';
	return {
		ok: true,
		value: {
			model: payload?.model || fallbackModel,
			content: typeof content === 'string' ? content.trim() : ''
		}
	};
};

const normalizeImageOutput = (payload) => {
	const data = Array.isArray(payload?.data) ? payload.data : [];
	const images = data
		.map((entry) => ({
			url: typeof entry?.url === 'string' ? entry.url : undefined,
			b64_json: typeof entry?.b64_json === 'string' ? entry.b64_json : undefined
		}))
		.filter((entry) => entry.url || entry.b64_json);
	const revisedPrompt =
		payload?.revised_prompt ||
		payload?.revisedPrompt ||
		data.find((entry) => typeof entry?.revised_prompt === 'string')?.revised_prompt;
	return {
		ok: true,
		value: {
			images,
			revisedPrompt: revisedPrompt
		}
	};
};

const writeFixture = async (name, value) => {
	const target = path.join(cwd, 'fixtures', 'provider-adapter', name);
	await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const run = async () => {
	await loadEnvFile();
	const apiKey = requireEnv('XAI_API_KEY');
	const baseUrl = process.env.XAI_BASE_URL || 'https://api.x.ai';

	const chatInput = {
		model: 'grok-4-1-fast-reasoning',
		messages: [
			{ role: 'system', content: 'Reply with the word OK.' },
			{ role: 'user', content: 'Hello' }
		]
	};
	const imageInput = {
		model: 'grok-2-image-1212',
		prompt: 'A black-and-white coloring book page with clean outlines.',
		n: 1,
		responseFormat: 'b64_json'
	};

	const chatResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: chatInput.model,
			messages: chatInput.messages
		})
	});
	const chatPayload = await readJson(chatResponse);
	const chatOutput = chatResponse.ok
		? normalizeChatOutput(chatPayload.value, chatInput.model)
		: buildError(chatResponse, chatPayload.value);

	const imageResponse = await fetch(`${baseUrl}/v1/images/generations`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: imageInput.model,
			prompt: imageInput.prompt,
			n: imageInput.n,
			response_format: imageInput.responseFormat
		})
	});
	const imagePayload = await readJson(imageResponse);
	const imageOutput = imageResponse.ok
		? normalizeImageOutput(imagePayload.value)
		: buildError(imageResponse, imagePayload.value);

	await writeFixture('sample.json', {
		scenario: 'sample',
		input: {
			chat: chatInput,
			image: imageInput
		},
		output: {
			chat: chatOutput,
			image: imageOutput
		}
	});

	const faultChatInput = {
		...chatInput,
		model: 'grok-4-1-fast-reasoning-bad'
	};
	const faultImageInput = {
		...imageInput,
		model: 'grok-2-image-1212-bad'
	};

	const faultChatResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: faultChatInput.model,
			messages: faultChatInput.messages
		})
	});
	const faultChatPayload = await readJson(faultChatResponse);
	const faultChatOutput = faultChatResponse.ok
		? normalizeChatOutput(faultChatPayload.value, faultChatInput.model)
		: buildError(faultChatResponse, faultChatPayload.value);

	const faultImageResponse = await fetch(`${baseUrl}/v1/images/generations`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: faultImageInput.model,
			prompt: faultImageInput.prompt,
			n: faultImageInput.n,
			response_format: faultImageInput.responseFormat
		})
	});
	const faultImagePayload = await readJson(faultImageResponse);
	const faultImageOutput = faultImageResponse.ok
		? normalizeImageOutput(faultImagePayload.value)
		: buildError(faultImageResponse, faultImagePayload.value);

	await writeFixture('fault.json', {
		scenario: 'fault',
		input: {
			chat: faultChatInput,
			image: faultImageInput
		},
		output: {
			chat: faultChatOutput,
			image: faultImageOutput
		}
	});

	const sampleContentLength =
		chatOutput.ok && typeof chatOutput.value.content === 'string'
			? chatOutput.value.content.length
			: 0;
	const imageLength =
		imageOutput.ok && imageOutput.value.images[0]?.b64_json
			? imageOutput.value.images[0].b64_json.length
			: 0;
	console.log(`Provider probe complete. Chat content length: ${sampleContentLength}.`);
	console.log(`Image base64 length: ${imageLength}.`);
};

run().catch((error) => {
	console.error('Provider probe failed.');
	console.error(error?.message || error);
	process.exit(1);
});
