// Purpose: Orchestrate the wig try-on flow: catalog lookup, image fetch, Gemini call.
// Why: Keep the route handler thin and the pipeline logic testable via injected seams.
// Info flow: wigId + selfieBase64 -> WigCatalogSeam -> image fetch -> WigTryOnSeam -> portrait Result.
import {
	WigTryOnRequestSchema,
	WigTryOnResultSchema
} from '../../../contracts/wig-try-on.contract';
import { z } from 'zod';
import type { WigCatalogSeam } from '../seams/wig-catalog-seam/contract';
import type { WigTryOnSeam } from '../seams/wig-try-on-seam/contract';

type WigTryOnResult = z.infer<typeof WigTryOnResultSchema>;

type PipelineResponse = {
	status: number;
	body: WigTryOnResult;
};

type PipelineDeps = {
	fetchImpl: (
		input: RequestInfo | URL,
		init?: RequestInit
	) => Promise<Response>;
	wigCatalogSeam: WigCatalogSeam;
	wigTryOnSeam: WigTryOnSeam;
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
	fetchImpl: PipelineDeps['fetchImpl']
): Promise<{ base64: string; mimeType: string } | null> => {
	try {
		const res = await fetchImpl(url);
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

export const runWigTryOnPipeline = async (
	body: unknown,
	deps: PipelineDeps
): Promise<PipelineResponse> => {
	const parsed = WigTryOnRequestSchema.safeParse(body);
	if (!parsed.success) {
		return buildError(
			400,
			'WIG_TRY_ON_INPUT_INVALID',
			'Wig try-on request is invalid.'
		);
	}

	const { selfieBase64, selfieMimeType, wigId } = parsed.data;

	const wigResult = await deps.wigCatalogSeam.getWigById(wigId);
	if (!wigResult.ok) {
		const status = wigResult.error.code === 'WIG_NOT_FOUND' ? 404 : 500;
		return buildError(status, wigResult.error.code, wigResult.error.message);
	}

	const wig = wigResult.value;

	const wigImage = await fetchImageAsBase64(wig.imageUrl, deps.fetchImpl);
	if (!wigImage) {
		return buildError(
			502,
			'WIG_IMAGE_FETCH_FAILED',
			`Could not fetch wig image for ${wig.name}.`
		);
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
		wigStyle: `${wig.style}, ${wig.color}, ${wig.length} length`
	});

	if (!tryOnResult.ok) {
		const isClientError =
			tryOnResult.error.code === 'WIG_TRY_ON_VALIDATION_ERROR';
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
		return buildError(
			500,
			'WIG_TRY_ON_OUTPUT_INVALID',
			'Wig try-on response did not match contract.'
		);
	}

	return { status: 200, body: validated.data };
};
