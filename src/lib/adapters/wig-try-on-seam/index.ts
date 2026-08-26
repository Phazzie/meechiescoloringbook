// Purpose: Implement WigTryOnSeam with xAI multi-image edit requests.
// Why: Keep image-edit provider I/O, credential handling, and error redaction behind one seam.
// Info flow: validated selfie + wig data URLs + catalogue wig name/style -> prompt builder ->
//      xAI image edit -> validated raster portrait Result.
import type { Result } from '../../../../contracts/shared.contract';
import { IMAGE_EDIT_MODEL } from '../../core/models';
import { isAbortError, isTimeoutError, runWithTimeoutSignal } from '../../core/http-resilience';
import type {
	ImageProviderConfig,
	ImageProviderConfigSeam
} from '../../seams/image-provider-config-seam/contract';
import type {
	WigTryOnError,
	WigTryOnMimeType,
	WigTryOnRequest,
	WigTryOnResult,
	WigTryOnSeam
} from '../../seams/wig-try-on-seam/contract';
import { validateWigTryOnRequest } from '../../seams/wig-try-on-seam/validators';

const WIG_TRY_ON_TIMEOUT_MS = 120_000;
const XAI_IMAGE_EDIT_PATH = '/v1/images/edits';

// Catalogue names and style descriptors arrive as free text, so a stray newline or a run of
// spaces would otherwise land in the middle of a sentence the model has to read.
const collapseWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

/**
 * Build the image-edit instruction for one try-on.
 *
 * Two things in here are load-bearing and were established by measurement, not taste:
 *
 * 1. This asks for a photorealistic portrait, not a coloring page. The section promises the user
 *    "See what you look like walking in"; a black-and-white line drawing does not keep that
 *    promise. Coloring pages are a separate feature with its own flow.
 * 2. Every wig photo in `static/wigs/` is shot under hot pink neon backlighting, and the model
 *    reads that cast as the hair colour — a run against `grok-imagine-image-2.0` returned
 *    rose-pink hair for "Honey Blonde Bombshell". Telling it to match the colour faithfully did
 *    not fix that on its own. Naming the wig in words *and* explicitly discounting the lighting
 *    did. Both halves have to stay.
 *
 * The catalogue text is optional at this level: if it is missing the identity sentence is dropped
 * whole rather than emitted half-written, and the surrounding instruction reworded so it never
 * refers back to a sentence that is not there. The seam's own validator still requires both
 * fields, so a real request cannot reach the provider without them.
 */
export const buildWigTryOnPrompt = (wigName: string, wigStyle: string): string => {
	const name = collapseWhitespace(wigName);
	const style = collapseWhitespace(wigStyle);

	const identity = name
		? style
			? `The wig is called '${name}': ${style}.`
			: `The wig is called '${name}'.`
		: style
			? `The wig is described as: ${style}.`
			: '';

	const placement = identity
		? 'Put that exact wig on that exact person in the colour and texture named above.'
		: "Put that exact wig on that exact person, matching the wig's own colour and texture rather than the neon cast of the product photo.";

	return [
		'The first image is the person.',
		'The second image is a wig product photo, shot under pink neon studio lighting -',
		'ignore that lighting colour entirely, it is not the hair colour.',
		identity,
		placement,
		"Keep the person's face, skin tone, features, tattoos and jewelry unchanged;",
		'only the hair changes.',
		'Photorealistic salon portrait, neutral daylight, clean background, no text and no watermarks.'
	]
		.filter((part) => part.length > 0)
		.join(' ');
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type XaiImageEditResponse = {
	data?: Array<{
		b64_json?: unknown;
	}>;
};

type XaiReadResult =
	| { kind: 'ok'; payload: XaiImageEditResponse }
	| { kind: 'http_error'; status: number }
	| { kind: 'parse_error' };

const errorResult = (error: WigTryOnError): Result<WigTryOnResult, WigTryOnError> => ({
	ok: false,
	error
});

const configError = (): Result<WigTryOnResult, WigTryOnError> =>
	errorResult({
		code: 'WIG_TRY_ON_CONFIG_ERROR',
		message: 'Image-edit provider configuration is unavailable.'
	});

// Strip trailing '/' (char code 47) linearly; a `/\/+$/` regex backtracks
// super-linearly on slash-heavy input.
const stripTrailingSlashes = (value: string): string => {
	let end = value.length;
	while (end > 0 && value.codePointAt(end - 1) === 47) {
		end -= 1;
	}
	return value.slice(0, end);
};

const buildEditUrl = (baseUrl: string): string =>
	`${stripTrailingSlashes(baseUrl)}${XAI_IMAGE_EDIT_PATH}`;

const toImageDataUrl = (mimeType: WigTryOnMimeType, base64: string): string =>
	`data:${mimeType};base64,${base64}`;

const startsWithBytes = (bytes: Uint8Array, signature: readonly number[]): boolean =>
	signature.every((byte, index) => bytes[index] === byte);

const detectRasterMimeType = (base64: string): WigTryOnMimeType | undefined => {
	let bytes: Buffer;
	try {
		bytes = Buffer.from(base64, 'base64');
	} catch {
		return undefined;
	}

	if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
	if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
		return 'image/png';
	}
	if (
		startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
		startsWithBytes(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
	) {
		return 'image/webp';
	}
	return undefined;
};

export const createWigTryOnSeam = (
	configSeam: ImageProviderConfigSeam,
	fetchImpl: FetchLike = fetch
): WigTryOnSeam => ({
	tryOn: async (
		request: WigTryOnRequest
	): Promise<Result<WigTryOnResult, WigTryOnError>> => {
		const callerSignal = request.signal;
		if (callerSignal?.aborted) {
			return errorResult({
				code: 'WIG_TRY_ON_ABORTED',
				message: 'Wig try-on request was canceled by the caller.'
			});
		}

		let validated: WigTryOnRequest;
		try {
			validated = validateWigTryOnRequest(request);
		} catch {
			return errorResult({
				code: 'WIG_TRY_ON_VALIDATION_ERROR',
				message: 'Wig try-on request failed validation.'
			});
		}

		let config: ImageProviderConfig;
		try {
			config = configSeam.getConfig();
		} catch {
			return configError();
		}
		if (!config.xaiApiKey.trim()) return configError();

		const endpoint = buildEditUrl(config.xaiBaseUrl);
		const requestBody = {
			model: IMAGE_EDIT_MODEL,
			prompt: buildWigTryOnPrompt(validated.wigName, validated.wigStyle),
			images: [
				{
					type: 'image_url',
					url: toImageDataUrl(validated.selfieMimeType, validated.selfieBase64)
				},
				{
					type: 'image_url',
					url: toImageDataUrl(validated.wigImageMimeType, validated.wigImageBase64)
				}
			],
			n: 1,
			response_format: 'b64_json'
		};

		const start = Date.now();
		let readResult: XaiReadResult;
		try {
			readResult = await runWithTimeoutSignal(
				async (signal): Promise<XaiReadResult> => {
					const response = await fetchImpl(endpoint, {
						method: 'POST',
						headers: {
							Authorization: `Bearer ${config.xaiApiKey}`,
							'Content-Type': 'application/json'
						},
						body: JSON.stringify(requestBody),
						signal
					});

					if (!response.ok) {
						try {
							await response.text();
						} catch (error) {
							if (isAbortError(error) || isTimeoutError(error)) throw error;
						}
						return { kind: 'http_error', status: response.status };
					}

					try {
						return { kind: 'ok', payload: (await response.json()) as XaiImageEditResponse };
					} catch (error) {
						if (isAbortError(error) || isTimeoutError(error)) throw error;
						return { kind: 'parse_error' };
					}
				},
				WIG_TRY_ON_TIMEOUT_MS,
				{
					signal: callerSignal,
					timeoutMessage: 'Wig try-on request timed out.'
				}
			);
		} catch (error) {
			if (callerSignal?.aborted || isAbortError(error)) {
				return errorResult({
					code: 'WIG_TRY_ON_ABORTED',
					message: 'Wig try-on request was canceled by the caller.'
				});
			}
			if (isTimeoutError(error)) {
				return errorResult({
					code: 'WIG_TRY_ON_TIMEOUT_ERROR',
					message: 'Wig try-on request timed out.'
				});
			}
			return errorResult({
				code: 'WIG_TRY_ON_NETWORK_ERROR',
				message: 'Image-edit provider network request failed.'
			});
		}

		if (readResult.kind === 'http_error') {
			return errorResult({
				code: 'WIG_TRY_ON_HTTP_ERROR',
				message: 'Image-edit provider rejected the request.',
				details: { status: String(readResult.status) }
			});
		}

		if (readResult.kind === 'parse_error') {
			return errorResult({
				code: 'WIG_TRY_ON_PARSE_ERROR',
				message: 'Image-edit provider returned an unreadable response.'
			});
		}

		const portraitBase64 = readResult.payload.data?.[0]?.b64_json;
		if (typeof portraitBase64 !== 'string' || portraitBase64.length === 0) {
			return errorResult({
				code: 'WIG_TRY_ON_EMPTY_RESPONSE',
				message: 'Image-edit provider returned no portrait.'
			});
		}

		const portraitMimeType = detectRasterMimeType(portraitBase64);
		if (!portraitMimeType) {
			return errorResult({
				code: 'WIG_TRY_ON_PARSE_ERROR',
				message: 'Image-edit provider returned an unreadable response.'
			});
		}

		return {
			ok: true,
			value: {
				portraitBase64,
				portraitMimeType,
				timingMs: Date.now() - start
			}
		};
	}
});
