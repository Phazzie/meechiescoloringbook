// Purpose: Orchestrate the wig try-on flow: catalog lookup, image fetch, Gemini call.
// Why: Keep the route handler thin and the pipeline logic testable via injected seams.
// Info flow: wigId + selfieBase64 -> WigCatalogSeam -> image fetch -> WigTryOnSeam -> portrait Result.
import { WigTryOnRequestSchema, WigTryOnResultSchema } from '../../../contracts/wig-try-on.contract';
import { z } from 'zod';
import type { Wig, WigCatalogSeam } from '../seams/wig-catalog-seam/contract';
import type { WigTryOnSeam } from '../seams/wig-try-on-seam/contract';

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

const fetchImageAsBase64 = async (
	url: string,
	fetchImpl: PipelineDeps['fetchImpl'],
	signal?: AbortSignal
): Promise<{ base64: string; mimeType: string } | null> => {
	try {
		const res = signal ? await fetchImpl(url, { signal }) : await fetchImpl(url);
		if (!res.ok) return null;
		const buffer = await res.arrayBuffer();
		const base64 = Buffer.from(buffer).toString('base64');
		const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
		return { base64, mimeType: mimeType.split(';')[0].trim() };
	} catch {
		return null;
	}
};

const ALLOWED_WIG_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type WigTryOnInputShapeCheck =
	| { ok: true; data: z.infer<typeof WigTryOnRequestSchema> }
	| { ok: false; response: PipelineResponse };

// Exported so the route can reject schema-invalid bodies before consuming rate-limit
// quota, without duplicating the WIG_TRY_ON_INPUT_INVALID code/message in two places.
export const checkWigTryOnInputShape = (body: unknown): WigTryOnInputShapeCheck => {
	const parsed = WigTryOnRequestSchema.safeParse(body);
	if (!parsed.success) {
		return {
			ok: false,
			response: buildError(400, 'WIG_TRY_ON_INPUT_INVALID', 'Wig try-on request is invalid.')
		};
	}
	return { ok: true, data: parsed.data };
};

export type WigCatalogPreflightCheck =
	| { ok: true; wig: Wig }
	| { ok: false; response: PipelineResponse };

// Exported so the route can reject unknown wig IDs before consuming rate-limit quota,
// without duplicating the WIG_NOT_FOUND code/message. getWigById is a cheap, cached,
// local catalog lookup — safe to run again inside runWigTryOnPipeline. The real network
// fetch of the wig image (fetchImageAsBase64) deliberately stays after rate limiting to
// avoid doubling outbound HTTP calls per request.
export const checkWigCatalogPreflight = async (
	wigId: string,
	wigCatalogSeam: PipelineDeps['wigCatalogSeam']
): Promise<WigCatalogPreflightCheck> => {
	const wigResult = await wigCatalogSeam.getWigById(wigId);
	if (!wigResult.ok) {
		const status = wigResult.error.code === 'WIG_NOT_FOUND' ? 404 : 500;
		return {
			ok: false,
			response: buildError(status, wigResult.error.code, wigResult.error.message)
		};
	}
	return { ok: true, wig: wigResult.value };
};

export const runWigTryOnPipeline = async (
	body: unknown,
	deps: PipelineDeps
): Promise<PipelineResponse> => {
	const shapeCheck = checkWigTryOnInputShape(body);
	if (!shapeCheck.ok) return shapeCheck.response;
	const { selfieBase64, selfieMimeType, wigId } = shapeCheck.data;

	const catalogCheck = await checkWigCatalogPreflight(wigId, deps.wigCatalogSeam);
	if (!catalogCheck.ok) return catalogCheck.response;

	const wig = catalogCheck.wig;

	const wigImage = await fetchImageAsBase64(wig.imageUrl, deps.fetchImpl, deps.signal);
	if (!wigImage) {
		return buildError(502, 'WIG_IMAGE_FETCH_FAILED', `Could not fetch wig image for ${wig.name}.`);
	}

	const safeMimeType = ALLOWED_WIG_MIME.has(wigImage.mimeType)
		? (wigImage.mimeType as 'image/jpeg' | 'image/png' | 'image/webp')
		: 'image/jpeg';

	const tryOnResult = await deps.wigTryOnSeam.tryOn({
		selfieBase64,
		selfieMimeType,
		wigImageBase64: wigImage.base64,
		wigImageMimeType: safeMimeType,
		wigName: wig.name,
		wigStyle: `${wig.style}, ${wig.color}, ${wig.length} length`,
		signal: deps.signal
	});

	if (!tryOnResult.ok) {
		const isClientError = tryOnResult.error.code === 'WIG_TRY_ON_VALIDATION_ERROR';
		return buildError(
			isClientError ? 400 : 502,
			tryOnResult.error.code,
			tryOnResult.error.message
		);
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
