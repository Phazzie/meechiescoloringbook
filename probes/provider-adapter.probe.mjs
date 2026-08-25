/*
Purpose: Probe the xAI provider endpoints for ProviderAdapterSeam fixtures.
Why: Capture real responses for chat and image generation to back mocks/tests.
Info flow: xAI responses -> normalized seam outputs -> fixtures/provider-adapter/*.json.
*/
import fs from 'node:fs/promises';
import path from 'node:path';
import { IMAGE_MODEL, TEXT_MODEL } from '../src/lib/core/models.js';

const cwd = process.cwd();

const CHAT_RESPONSE_FORMAT = {
	type: 'json_schema',
	json_schema: {
		name: 'provider_probe',
		strict: true,
		schema: {
			type: 'object',
			additionalProperties: false,
			properties: { status: { type: 'string', enum: ['OK'] } },
			required: ['status']
		}
	}
};

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

// Mirrors readProviderMessage in src/lib/adapters/provider-adapter.adapter.ts. xAI returns
// `error` as a bare string, not the OpenAI-style nested `error.message`. Reading only the
// nested form made the probe discard the provider's real text — the same defect that hid a
// retired-model outage behind a bare "Bad Request".
const readProviderMessage = (payload) => {
	if (!payload) return undefined;
	const candidates = [
		typeof payload.error === 'object' && payload.error !== null
			? payload.error.message
			: undefined,
		typeof payload.error === 'string' ? payload.error : undefined,
		payload.message,
		payload.detail
	];
	for (const candidate of candidates) {
		if (typeof candidate === 'string' && candidate.trim().length > 0)
			return candidate.trim();
	}
	return undefined;
};

const buildError = (response, payload) => {
	const message =
		readProviderMessage(payload) ||
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

const buildLocalError = (code, message) => ({
	ok: false,
	error: { code, message }
});

const normalizeChatOutput = (payload, fallbackModel) => {
	const content =
		payload?.choices?.[0]?.message?.content ||
		payload?.choices?.[0]?.text ||
		'';
	if (typeof content !== 'string' || content.trim().length === 0) {
		return buildLocalError(
			'PROVIDER_EMPTY_CHAT',
			'Provider returned empty chat content.'
		);
	}
	return {
		ok: true,
		value: {
			model: payload?.model || fallbackModel,
			content: content.trim()
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
		data.find((entry) => typeof entry?.revised_prompt === 'string')
			?.revised_prompt;
	if (images.length === 0) {
		return buildLocalError(
			'PROVIDER_EMPTY_IMAGE',
			'Provider returned no images.'
		);
	}
	return {
		ok: true,
		value: {
			images,
			revisedPrompt: revisedPrompt
		}
	};
};

const summarizeOutput = (label, output) => {
	if (!output.ok) {
		return `${label} ${output.error.code}: ${output.error.message}`;
	}
	if (label === 'chat') {
		return `${label} ok (${output.value.content.length} content chars)`;
	}
	return `${label} ok (${output.value.images.length} image result(s))`;
};

const requireSampleSuccess = (chatOutput, imageOutput) => {
	if (chatOutput.ok && imageOutput.ok) return;
	throw new Error(
		`Live sample validation failed; fixtures were left unchanged. ${summarizeOutput('chat', chatOutput)}; ${summarizeOutput('image', imageOutput)}.`
	);
};

const requireFaultSuccess = (chatOutput, imageOutput) => {
	if (!chatOutput.ok && !imageOutput.ok) return;
	throw new Error(
		`Fault validation unexpectedly succeeded; fixtures were left unchanged. ${summarizeOutput('chat', chatOutput)}; ${summarizeOutput('image', imageOutput)}.`
	);
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
		model: TEXT_MODEL,
		messages: [
			{ role: 'system', content: 'Return JSON with status set to OK.' },
			{ role: 'user', content: 'Hello' }
		],
		responseFormat: CHAT_RESPONSE_FORMAT
	};
	const imageInput = {
		model: IMAGE_MODEL,
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
			messages: chatInput.messages,
			response_format: chatInput.responseFormat
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

	const sampleFixture = {
		scenario: 'sample',
		provenance: {
			kind: 'live-capture',
			capturedAt: new Date().toISOString()
		},
		input: {
			chat: chatInput,
			image: imageInput
		},
		output: {
			chat: chatOutput,
			image: imageOutput
		}
	};

	requireSampleSuccess(chatOutput, imageOutput);

	const faultChatInput = {
		...chatInput,
		model: `${TEXT_MODEL}-bad`
	};
	const faultImageInput = {
		...imageInput,
		model: `${IMAGE_MODEL}-bad`
	};

	const faultChatResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: faultChatInput.model,
			messages: faultChatInput.messages,
			response_format: faultChatInput.responseFormat
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

	const faultFixture = {
		scenario: 'fault',
		provenance: {
			kind: 'live-capture',
			capturedAt: new Date().toISOString()
		},
		input: {
			chat: faultChatInput,
			image: faultImageInput
		},
		output: {
			chat: faultChatOutput,
			image: faultImageOutput
		}
	};

	requireFaultSuccess(faultChatOutput, faultImageOutput);
	await writeFixture('sample.json', sampleFixture);
	await writeFixture('fault.json', faultFixture);

	const sampleContentLength =
		chatOutput.ok && typeof chatOutput.value.content === 'string'
			? chatOutput.value.content.length
			: 0;
	const imageCount = imageOutput.ok ? imageOutput.value.images.length : 0;
	console.log(
		`Provider probe complete. Chat content length: ${sampleContentLength}.`
	);
	console.log(`Image result count: ${imageCount}.`);
};

run().catch((error) => {
	console.error('Provider probe failed.');
	console.error(error?.message || error);
	process.exit(1);
});
