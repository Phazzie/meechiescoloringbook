// Purpose: Verify wig-image bytes are validated before the try-on provider is invoked.
// Why: Packaged or remote files can have misleading headers, empty bodies, or unsupported content.
// Info flow: catalog wig + fake image response -> pipeline MIME sniff -> WigTryOnSeam request or safe 502.
import { describe, expect, it, vi } from 'vitest';
import { runWigTryOnPipeline } from '../../src/lib/core/wig-try-on-pipeline';
import { sampleWigFixture } from '../../src/lib/seams/wig-catalog-seam/fixtures';
import type { WigCatalogSeam } from '../../src/lib/seams/wig-catalog-seam/contract';
import type {
	WigTryOnError,
	WigTryOnSeam
} from '../../src/lib/seams/wig-try-on-seam/contract';
import { WIG_TRY_ON_PNG_BASE64 } from '../../src/lib/seams/wig-try-on-seam/fixtures';

const requestBody = {
	selfieBase64: WIG_TRY_ON_PNG_BASE64,
	selfieMimeType: 'image/png' as const,
	wigId: sampleWigFixture.id
};

const wig = {
	...sampleWigFixture,
	imageUrl: '/wigs/wig-001-sleek-straight-goddess.jpg'
};

const buildDeps = (fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) => {
	const wigCatalogSeam: WigCatalogSeam = {
		listWigs: vi.fn(),
		getWigById: vi.fn(async () => ({ ok: true as const, value: wig }))
	};
	const tryOn = vi.fn<WigTryOnSeam['tryOn']>();
	tryOn.mockResolvedValue({
		ok: true,
		value: {
			portraitBase64: WIG_TRY_ON_PNG_BASE64,
			portraitMimeType: 'image/png',
			timingMs: 1
		}
	});
	const wigTryOnSeam: WigTryOnSeam = { tryOn };

	return {
		deps: { fetchImpl, wigCatalogSeam, wigTryOnSeam },
		tryOn
	};
};

const rasterCases = [
	{
		name: 'JPEG',
		bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]),
		misleadingHeader: 'image/png',
		expectedMimeType: 'image/jpeg'
	},
	{
		name: 'PNG',
		bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		misleadingHeader: 'image/jpeg',
		expectedMimeType: 'image/png'
	},
	{
		name: 'WebP',
		bytes: new Uint8Array([
			0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
		]),
		misleadingHeader: 'application/octet-stream',
		expectedMimeType: 'image/webp'
	}
] as const;

describe('wig try-on image loading', () => {
	it.each(rasterCases)(
		'detects $name bytes instead of trusting a misleading response header',
		async ({ bytes, misleadingHeader, expectedMimeType }) => {
			const fetchImpl = vi.fn(async () =>
				new Response(bytes, {
					status: 200,
					headers: { 'Content-Type': misleadingHeader }
				})
			);
			const { deps, tryOn } = buildDeps(fetchImpl);

			const result = await runWigTryOnPipeline(requestBody, deps);

			expect(result.status).toBe(200);
			expect(tryOn).toHaveBeenCalledTimes(1);
			expect(tryOn).toHaveBeenCalledWith(
				expect.objectContaining({
					wigImageBase64: Buffer.from(bytes).toString('base64'),
					wigImageMimeType: expectedMimeType
				})
			);
		}
	);

	it.each([
		{
			name: 'a non-success response',
			fetchImpl: async () => new Response('missing', { status: 404 })
		},
		{
			name: 'an empty response body',
			fetchImpl: async () => new Response(new Uint8Array(), { status: 200 })
		},
		{
			name: 'unsupported image bytes',
			fetchImpl: async () =>
				new Response(new Uint8Array([0x47, 0x49, 0x46, 0x38]), {
					status: 200,
					headers: { 'Content-Type': 'image/jpeg' }
				})
		},
		{
			name: 'a failed image request',
			fetchImpl: async () => {
				throw new Error('network detail');
			}
		}
	])('returns a safe 502 and makes no provider call for $name', async ({ fetchImpl }) => {
		const fetchMock = vi.fn(fetchImpl);
		const { deps, tryOn } = buildDeps(fetchMock);

		const result = await runWigTryOnPipeline(requestBody, deps);

		expect(result).toEqual({
			status: 502,
			body: {
				ok: false,
				error: {
					code: 'WIG_IMAGE_FETCH_FAILED',
					message: 'Could not load the selected wig image.'
				}
			}
		});
		expect(tryOn).not.toHaveBeenCalled();
	});
});

const validJpegFetch = () =>
	vi.fn(async () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), { status: 200 }));

const providerErrorCases: ReadonlyArray<{
	error: WigTryOnError;
	status: number;
	message: string;
}> = [
	{
		error: {
			code: 'WIG_TRY_ON_VALIDATION_ERROR',
			message: 'SECRET_VALIDATION_DETAIL'
		},
		status: 400,
		message: 'Wig try-on request is invalid.'
	},
	{
		error: { code: 'WIG_TRY_ON_CONFIG_ERROR', message: 'SECRET_CONFIG_DETAIL' },
		status: 503,
		message: 'Wig try-on is temporarily unavailable.'
	},
	{
		error: { code: 'WIG_TRY_ON_ABORTED', message: 'SECRET_ABORT_DETAIL' },
		status: 499,
		message: 'Wig try-on request was canceled.'
	},
	{
		error: { code: 'WIG_TRY_ON_TIMEOUT_ERROR', message: 'SECRET_TIMEOUT_DETAIL' },
		status: 504,
		message: 'Wig try-on request timed out.'
	},
	...(
		[
			{ code: 'WIG_TRY_ON_NETWORK_ERROR', message: 'https://provider.test/?key=SECRET_KEY' },
			{
				code: 'WIG_TRY_ON_HTTP_ERROR',
				message: 'SECRET_PROVIDER_BODY',
				details: { status: '500' }
			},
			{ code: 'WIG_TRY_ON_PARSE_ERROR', message: 'SECRET_PARSE_BODY' },
			{ code: 'WIG_TRY_ON_EMPTY_RESPONSE', message: 'SECRET_EMPTY_BODY' }
		] satisfies WigTryOnError[]
	).map((error) => ({
		error,
		status: 502,
		message: 'Wig try-on could not create a portrait.'
	}))
];

describe('wig try-on user-safe error mapping', () => {
	it.each(providerErrorCases)(
		'maps $error.code to $status without exposing adapter details',
		async ({ error, status, message }) => {
			const { deps, tryOn } = buildDeps(validJpegFetch());
			tryOn.mockResolvedValueOnce({ ok: false, error });

			const result = await runWigTryOnPipeline(requestBody, deps);

			expect(result).toEqual({
				status,
				body: { ok: false, error: { code: error.code, message } }
			});
			expect(JSON.stringify(result)).not.toContain('SECRET');
			expect(JSON.stringify(result)).not.toContain('provider.test');
		}
	);

	it('returns 499 without fetching when the caller already canceled', async () => {
		const controller = new AbortController();
		controller.abort();
		const fetchImpl = validJpegFetch();
		const { deps, tryOn } = buildDeps(fetchImpl);

		const result = await runWigTryOnPipeline(requestBody, {
			...deps,
			signal: controller.signal
		});

		expect(result).toEqual({
			status: 499,
			body: {
				ok: false,
				error: { code: 'WIG_TRY_ON_ABORTED', message: 'Wig try-on request was canceled.' }
			}
		});
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(tryOn).not.toHaveBeenCalled();
	});

	it.each([
		{
			catalogError: {
				code: 'WIG_NOT_FOUND' as const,
				message: 'SECRET_NOT_FOUND_DETAIL',
				details: { id: sampleWigFixture.id }
			},
			status: 404,
			message: 'Selected wig was not found.'
		},
		{
			catalogError: {
				code: 'WIG_CATALOG_LOAD_FAILED' as const,
				message: 'SECRET_CATALOG_DETAIL'
			},
			status: 500,
			message: 'Wig catalog is unavailable.'
		}
	])('maps $catalogError.code without exposing catalog details', async ({ catalogError, status, message }) => {
		const fetchImpl = validJpegFetch();
		const wigCatalogSeam: WigCatalogSeam = {
			listWigs: vi.fn(),
			getWigById: vi.fn(async () => ({ ok: false as const, error: catalogError }))
		};
		const tryOn = vi.fn<WigTryOnSeam['tryOn']>();

		const result = await runWigTryOnPipeline(requestBody, {
			fetchImpl,
			wigCatalogSeam,
			wigTryOnSeam: { tryOn }
		});

		expect(result).toEqual({
			status,
			body: { ok: false, error: { code: catalogError.code, message } }
		});
		expect(JSON.stringify(result)).not.toContain('SECRET');
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(tryOn).not.toHaveBeenCalled();
	});

	it('uses a generic message when the wig image cannot be loaded', async () => {
		const { deps, tryOn } = buildDeps(vi.fn(async () => new Response('SECRET_BODY', { status: 500 })));

		const result = await runWigTryOnPipeline(requestBody, deps);

		expect(result).toEqual({
			status: 502,
			body: {
				ok: false,
				error: {
					code: 'WIG_IMAGE_FETCH_FAILED',
					message: 'Could not load the selected wig image.'
				}
			}
		});
		expect(JSON.stringify(result)).not.toContain('SECRET');
		expect(tryOn).not.toHaveBeenCalled();
	});

	it('returns a stable 500 when a successful seam result violates the public contract', async () => {
		const { deps, tryOn } = buildDeps(validJpegFetch());
		tryOn.mockResolvedValueOnce({
			ok: true,
			value: { portraitBase64: '', portraitMimeType: 'image/png', timingMs: 1 }
		});

		const result = await runWigTryOnPipeline(requestBody, deps);

		expect(result).toEqual({
			status: 500,
			body: {
				ok: false,
				error: {
					code: 'WIG_TRY_ON_OUTPUT_INVALID',
					message: 'Wig try-on response did not match contract.'
				}
			}
		});
	});
});
