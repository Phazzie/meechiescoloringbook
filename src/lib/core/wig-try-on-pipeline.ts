// Purpose: Orchestrate the wig try-on flow: catalog lookup, image validation, provider call.
// Why: Keep the route handler thin and the pipeline logic testable via injected seams.
// Info flow: wigId + selfieBase64 -> WigCatalogSeam -> raster-byte sniff -> WigTryOnSeam -> portrait Result.
import { WigTryOnRequestSchema, WigTryOnResultSchema } from '../../../contracts/wig-try-on.contract';
import { z } from 'zod';
import type { WigCatalogSeam } from '../seams/wig-catalog-seam/contract';
import type { WigTryOnError, WigTryOnSeam } from '../seams/wig-try-on-seam/contract';

type WigTryOnResult = z.infer<typeof WigTryOnResultSchema>;

type PipelineResponse = {
	status: number;
	body: WigTryOnResult;
};

type PipelineDeps = {
	fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
	wigCatalogSeam: WigCatalogSeam;
	wigTryOnSeam: WigTryOnSeam;
	signal?: AbortSignal;
};

const buildError = (
	status: number,
	code: string,
	message: string
): PipelineResponse => ({
	status,
	body: { ok: false, error: { code, message } }
});

const canceledResponse = (): PipelineResponse =>
	buildError(499, 'WIG_TRY_ON_ABORTED', 'Wig try-on request was canceled.');

const mapTryOnError = (error: WigTryOnError): PipelineResponse => {
	switch (error.code) {
		case 'WIG_TRY_ON_VALIDATION_ERROR':
			return buildError(400, error.code, 'Wig try-on request is invalid.');
		case 'WIG_TRY_ON_CONFIG_ERROR':
			return buildError(503, error.code, 'Wig try-on is temporarily unavailable.');
		case 'WIG_TRY_ON_ABORTED':
			return canceledResponse();
		case 'WIG_TRY_ON_TIMEOUT_ERROR':
			return buildError(504, error.code, 'Wig try-on request timed out.');
		case 'WIG_TRY_ON_HTTP_ERROR':
		case 'WIG_TRY_ON_NETWORK_ERROR':
		case 'WIG_TRY_ON_PARSE_ERROR':
		case 'WIG_TRY_ON_EMPTY_RESPONSE':
			return buildError(502, error.code, 'Wig try-on could not create a portrait.');
	}
};

const fetchImageAsBase64 = async (
	url: string,
	fetchImpl: PipelineDeps['fetchImpl'],
	signal?: AbortSignal
): Promise<{ base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' } | null> => {
	try {
		const res = signal ? await fetchImpl(url, { signal }) : await fetchImpl(url);
		if (!res.ok) return null;
		const buffer = await res.arrayBuffer();
		const bytes = new Uint8Array(buffer);
		if (bytes.length === 0) return null;
		const mimeType = detectRasterMimeType(bytes);
		if (!mimeType) return null;
		return { base64: Buffer.from(bytes).toString('base64'), mimeType };
	} catch {
		return null;
	}
};

const startsWithBytes = (bytes: Uint8Array, signature: readonly number[]): boolean =>
	signature.every((byte, index) => bytes[index] === byte);

const detectRasterMimeType = (
	bytes: Uint8Array
): 'image/jpeg' | 'image/png' | 'image/webp' | null => {
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
	return null;
};

export const runWigTryOnPipeline = async (
	body: unknown,
	deps: PipelineDeps
): Promise<PipelineResponse> => {
	const parsed = WigTryOnRequestSchema.safeParse(body);
	if (!parsed.success) {
		return buildError(400, 'WIG_TRY_ON_INPUT_INVALID', 'Wig try-on request is invalid.');
	}
	if (deps.signal?.aborted) return canceledResponse();

	const { selfieBase64, selfieMimeType, wigId } = parsed.data;

	const wigResult = await deps.wigCatalogSeam.getWigById(wigId);
	if (!wigResult.ok) {
		if (wigResult.error.code === 'WIG_NOT_FOUND') {
			return buildError(404, wigResult.error.code, 'Selected wig was not found.');
		}
		return buildError(500, wigResult.error.code, 'Wig catalog is unavailable.');
	}

	const wig = wigResult.value;

	const wigImage = await fetchImageAsBase64(wig.imageUrl, deps.fetchImpl, deps.signal);
	if (!wigImage) {
		if (deps.signal?.aborted) return canceledResponse();
		return buildError(502, 'WIG_IMAGE_FETCH_FAILED', 'Could not load the selected wig image.');
	}
	if (deps.signal?.aborted) return canceledResponse();

	const tryOnResult = await deps.wigTryOnSeam.tryOn({
		selfieBase64,
		selfieMimeType,
		wigImageBase64: wigImage.base64,
		wigImageMimeType: wigImage.mimeType,
		wigName: wig.name,
		wigStyle: `${wig.style}, ${wig.color}, ${wig.length} length`,
		signal: deps.signal
	});

	if (!tryOnResult.ok) {
		return mapTryOnError(tryOnResult.error);
	}

	const result: WigTryOnResult = {
		ok: true,
		value: {
			portraitBase64: tryOnResult.value.portraitBase64,
			portraitMimeType: tryOnResult.value.portraitMimeType
		}
	};

	const validated = WigTryOnResultSchema.safeParse(result);
	if (!validated.success) {
		return buildError(500, 'WIG_TRY_ON_OUTPUT_INVALID', 'Wig try-on response did not match contract.');
	}

	return { status: 200, body: validated.data };
};
