// Purpose: Prove production image-provider wiring without making a live provider request.
// Why: Exercise config, adapter, and pipeline composition through a strict credentialless transport.
// Info flow: fake env -> quota gate -> production config/adapter/pipeline -> stubbed xAI response -> public result.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createImageProviderConfigSeam } from '../../src/lib/adapters/image-provider-config-seam';
import { createImageGenerationSeam } from '../../src/lib/adapters/image-generation-seam';
import { runImageGenerationPipeline } from '../../src/lib/core/image-generation-pipeline';
import { IMAGE_MODEL } from '../../src/lib/core/models';
import { makeBaseSpec } from '../helpers/make-base-spec';

const FAKE_BASE_URL = 'https://xai.invalid';
const FAKE_ENDPOINT_PATH = '/v1/images/generations';
const FAKE_ENDPOINT_URL = `${FAKE_BASE_URL}${FAKE_ENDPOINT_PATH}`;
const FAKE_API_KEY = 'credentialless-integration-key';
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ';

const validPrompt = [
	'Black-and-white coloring book page',
	'outline-only',
	'easy to color',
	'Crisp vector-like linework',
	'NEGATIVE PROMPT:',
	'US Letter 8.5x11 portrait.'
].join(' ');

const requestUrl = (input: RequestInfo | URL): string =>
	input instanceof Request ? input.url : input.toString();

describe('credentialless production image-provider wiring', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('composes config, adapter, and pipeline through only the explicitly stubbed URL', async () => {
		const strictFakeFetch = vi.fn(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = requestUrl(input);
				if (url !== FAKE_ENDPOINT_URL) {
					throw new Error(`Blocked unstubbed network URL: ${url}`);
				}

				expect(init?.method).toBe('POST');
				expect(init?.headers).toEqual({
					Authorization: `Bearer ${FAKE_API_KEY}`,
					'Content-Type': 'application/json'
				});
				expect(JSON.parse(String(init?.body))).toMatchObject({
					model: IMAGE_MODEL,
					n: 1,
					response_format: 'b64_json'
				});

				return new Response(
					JSON.stringify({
						data: [
							{
								b64_json: PNG_BASE64,
								revised_prompt: 'Credentialless fixture prompt.'
							}
						]
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
		);
		vi.stubGlobal('fetch', strictFakeFetch);

		const configSeam = createImageProviderConfigSeam({
			XAI_API_KEY: FAKE_API_KEY,
			XAI_BASE_URL: FAKE_BASE_URL,
			XAI_IMAGE_ENDPOINT_PATH: FAKE_ENDPOINT_PATH
		});
		const imageGenerationSeam = createImageGenerationSeam(configSeam);

		// R1 requires the quota gate to be consulted BEFORE any billable call. Capturing the
		// fetch count at the moment the gate runs proves ordering without disturbing the strict
		// fake, which is the thing actually under test here.
		let fetchCallsWhenCharged = -1;
		const consumeQuota = vi.fn(async (_cost: number) => {
			fetchCallsWhenCharged = strictFakeFetch.mock.calls.length;
			return { ok: true as const, headers: { 'RateLimit-Remaining': '7' } };
		});

		const result = await runImageGenerationPipeline(
			{
				spec: makeBaseSpec(),
				prompt: validPrompt,
				variations: 1,
				outputFormat: 'pdf'
			},
			{ imageGenerationSeam, quota: { mode: 'charge', consumeQuota } }
		);

		// The gate ran, charged exactly the requested variation count, and no provider request
		// had gone out at that point.
		expect(consumeQuota).toHaveBeenCalledExactlyOnceWith(1);
		expect(fetchCallsWhenCharged).toBe(0);

		expect(result.status).toBe(200);
		expect(result.body.ok).toBe(true);
		if (!result.body.ok) return;
		expect(result.body.value.images).toEqual([
			expect.objectContaining({ data: PNG_BASE64, mimeType: 'image/png' })
		]);
		expect(result.body.value.modelMetadata).toEqual({
			provider: 'xai',
			model: IMAGE_MODEL
		});
		expect(strictFakeFetch).toHaveBeenCalledOnce();
		expect(requestUrl(strictFakeFetch.mock.calls[0][0])).toBe(
			FAKE_ENDPOINT_URL
		);
	});
});
