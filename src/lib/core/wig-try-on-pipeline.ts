// Purpose: Orchestrate the wig try-on flow: catalog lookup, image validation, quota charge, provider call.
// Why: Keep the route handler thin and the pipeline logic testable via injected seams.
// Info flow: wigId + selfieBase64 -> WigCatalogSeam -> raster-byte sniff -> image quota charge -> WigTryOnSeam -> portrait Result.
import {
	WigTryOnRequestSchema,
	WigTryOnResultSchema
} from '../../../contracts/wig-try-on.contract';
import { z } from 'zod';
import { toPublicProviderError } from './public-provider-error';
import type { WigCatalogSeam } from '../seams/wig-catalog-seam/contract';
import type {
	WigTryOnError,
	WigTryOnSeam
} from '../seams/wig-try-on-seam/contract';
import type { QuotaGate } from '../server/rate-limit-route';

type WigTryOnResult = z.infer<typeof WigTryOnResultSchema>;

type PipelineResponse = {
	status: number;
	body: WigTryOnResult;
	/**
	 * Rate-limit headers exactly as the quota gate derived them. Absent on every response
	 * decided before the charge, present on every response decided after it.
	 */
	headers?: Record<string, string>;
};

type PipelineDeps = {
	fetchImpl: (
		input: RequestInfo | URL,
		init?: RequestInit
	) => Promise<Response>;
	wigCatalogSeam: WigCatalogSeam;
	wigTryOnSeam: WigTryOnSeam;
	/**
	 * Required. An optional gate would be a production bypass: any caller reaching this pipeline
	 * without one would spend a provider image credit unmetered.
	 */
	consumeQuota: QuotaGate;
	signal?: AbortSignal;
};

/** One try-on is exactly one provider edit call, so it charges one image unit. */
const WIG_TRY_ON_QUOTA_COST = 1;

const buildError = (
	status: number,
	code: string,
	message: string,
	headers?: Record<string, string>
): PipelineResponse => ({
	status,
	body: { ok: false, error: { code, message } },
	...(headers ? { headers } : {})
});

// Only reachable before the charge; a provider-reported abort goes through mapTryOnError instead.
const canceledResponse = (): PipelineResponse =>
	buildError(499, 'WIG_TRY_ON_ABORTED', 'Wig try-on request was canceled.');

const buildProviderError = (
	status: number,
	error: WigTryOnError,
	message: string,
	headers?: Record<string, string>
): PipelineResponse => {
	const publicError = toPublicProviderError(error, {
		code: error.code,
		message
	});
	return buildError(status, publicError.code, publicError.message, headers);
};

const mapTryOnError = (
	error: WigTryOnError,
	headers: Record<string, string>
): PipelineResponse => {
	switch (error.code) {
		case 'WIG_TRY_ON_VALIDATION_ERROR':
			return buildProviderError(
				400,
				error,
				'Wig try-on request is invalid.',
				headers
			);
		case 'WIG_TRY_ON_CONFIG_ERROR':
			return buildProviderError(
				503,
				error,
				'Wig try-on is temporarily unavailable.',
				headers
			);
		case 'WIG_TRY_ON_ABORTED':
			return buildProviderError(
				499,
				error,
				'Wig try-on request was canceled.',
				headers
			);
		case 'WIG_TRY_ON_TIMEOUT_ERROR':
			return buildProviderError(
				504,
				error,
				'Wig try-on request timed out.',
				headers
			);
		case 'WIG_TRY_ON_HTTP_ERROR':
		case 'WIG_TRY_ON_NETWORK_ERROR':
		case 'WIG_TRY_ON_PARSE_ERROR':
		case 'WIG_TRY_ON_EMPTY_RESPONSE':
			return buildProviderError(
				502,
				error,
				'Wig try-on could not create a portrait.',
				headers
			);
	}
};

const fetchImageAsBase64 = async (
	url: string,
	fetchImpl: PipelineDeps['fetchImpl'],
	signal?: AbortSignal
): Promise<{
	base64: string;
	mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
} | null> => {
	try {
		const res = signal
			? await fetchImpl(url, { signal })
			: await fetchImpl(url);
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

const startsWithBytes = (
	bytes: Uint8Array,
	signature: readonly number[]
): boolean => signature.every((byte, index) => bytes[index] === byte);

const detectRasterMimeType = (
	bytes: Uint8Array
): 'image/jpeg' | 'image/png' | 'image/webp' | null => {
	if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
	if (
		startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
	) {
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
		return buildError(
			400,
			'WIG_TRY_ON_INPUT_INVALID',
			'Wig try-on request is invalid.'
		);
	}
	if (deps.signal?.aborted) return canceledResponse();

	const { selfieBase64, selfieMimeType, wigId } = parsed.data;

	const wigResult = await deps.wigCatalogSeam.getWigById(wigId);
	if (!wigResult.ok) {
		if (wigResult.error.code === 'WIG_NOT_FOUND') {
			return buildError(
				404,
				wigResult.error.code,
				'Selected wig was not found.'
			);
		}
		return buildError(500, wigResult.error.code, 'Wig catalog is unavailable.');
	}

	const wig = wigResult.value;

	const wigImage = await fetchImageAsBase64(
		wig.imageUrl,
		deps.fetchImpl,
		deps.signal
	);
	if (!wigImage) {
		if (deps.signal?.aborted) return canceledResponse();
		return buildError(
			502,
			'WIG_IMAGE_FETCH_FAILED',
			'Could not load the selected wig image.'
		);
	}
	if (deps.signal?.aborted) return canceledResponse();

	// Everything above can reject without spending a provider credit: bad input, a wig that does
	// not exist, an unreachable or non-raster wig image, a caller who already hung up. The charge
	// belongs here, immediately before the one billable call, so none of those paths pays for it.
	const quota = await deps.consumeQuota(WIG_TRY_ON_QUOTA_COST);
	if (!quota.ok) {
		// Verbatim from the gate. Retry-After and the reset window come from the store's own
		// instant; recomputing them here would drift from the bucket that denied the request.
		return { status: quota.status, body: quota.body, headers: quota.headers };
	}
	const quotaHeaders = quota.headers;

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
		return mapTryOnError(tryOnResult.error, quotaHeaders);
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
			'Wig try-on response did not match contract.',
			quotaHeaders
		);
	}

	return { status: 200, body: validated.data, headers: quotaHeaders };
};
