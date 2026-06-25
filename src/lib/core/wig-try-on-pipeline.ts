// Purpose: Orchestrate the wig try-on flow: catalog lookup, image fetch, Gemini call.
// Why: Keep the route handler thin and the pipeline logic testable via injected seams.
// Info flow: wigId + selfieBase64 -> WigCatalogSeam -> image fetch -> WigTryOnSeam -> portrait Result.
import { WigTryOnRequestSchema, WigTryOnResultSchema } from '../../../contracts/wig-try-on.contract';
import { z } from 'zod';
import type { WigCatalogSeam } from '../seams/wig-catalog-seam/contract';
import type { WigTryOnSeam } from '../seams/wig-try-on-seam/contract';
import { isAbortError } from './http-resilience';

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

type FetchImageResult =
	| { kind: 'ok'; base64: string; mimeType: string }
	| { kind: 'aborted' }
	| { kind: 'failed' };

const fetchImageAsBase64 = async (
	url: string,
	fetchImpl: PipelineDeps['fetchImpl'],
	signal?: AbortSignal
): Promise<FetchImageResult> => {
	try {
		const res = signal ? await fetchImpl(url, { signal }) : await fetchImpl(url);
		if (!res.ok) return { kind: 'failed' };
		const buffer = await res.arrayBuffer();
		const base64 = Buffer.from(buffer).toString('base64');
		const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
		return { kind: 'ok', base64, mimeType: mimeType.split(';')[0].trim() };
	} catch (error) {
		if (isAbortError(error)) return { kind: 'aborted' };
		return { kind: 'failed' };
	}
};

const ALLOWED_WIG_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const runWigTryOnPipeline = async (
	body: unknown,
	deps: PipelineDeps
): Promise<PipelineResponse> => {
	if (deps.signal?.aborted) {
		return buildError(499, 'WIG_TRY_ON_ABORTED', 'Wig try-on request was canceled by the caller.');
	}

	const parsed = WigTryOnRequestSchema.safeParse(body);
	if (!parsed.success) {
		return buildError(400, 'WIG_TRY_ON_INPUT_INVALID', 'Wig try-on request is invalid.');
	}

	const { selfieBase64, selfieMimeType, wigId } = parsed.data;

	const wigResult = await deps.wigCatalogSeam.getWigById(wigId);
	if (!wigResult.ok) {
		const status = wigResult.error.code === 'WIG_NOT_FOUND' ? 404 : 500;
		return buildError(status, wigResult.error.code, wigResult.error.message);
	}

	const wig = wigResult.value;

	const wigImage = await fetchImageAsBase64(wig.imageUrl, deps.fetchImpl, deps.signal);
	if (wigImage.kind === 'aborted') {
		return buildError(499, 'WIG_TRY_ON_ABORTED', 'Wig try-on request was canceled by the caller.');
	}
	if (wigImage.kind === 'failed') {
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
