// Purpose: Detect a raster image's real MIME type from its byte signature.
// Why: A base64-string-prefix guess silently mislabels anything it doesn't recognize (e.g. a
//      real WebP response defaulting to PNG); this exact byte-signature check was independently
//      duplicated across the wig-try-on pipeline/adapter and the image-generation pipeline, so it
//      now lives in one place both can import.
// Info flow: raw bytes or a base64 string -> byte-signature match -> a RasterMimeType, or null.

import type { GeneratedImage } from '../../../contracts/image-generation.contract';

export type RasterMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

const startsWithBytes = (bytes: Uint8Array, signature: readonly number[]): boolean =>
	signature.every((byte, index) => bytes[index] === byte);

export const detectRasterMimeTypeFromBytes = (bytes: Uint8Array): RasterMimeType | null => {
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

export const detectRasterMimeTypeFromBase64 = (base64: string): RasterMimeType | null => {
	try {
		return detectRasterMimeTypeFromBytes(Buffer.from(base64, 'base64'));
	} catch {
		return null;
	}
};

// `Buffer` is not in the browser bundle, so the decoder above returns `null` for every image when
// called from a component — valid ones included. `atob` exists in both the browser and Node, so
// anything that runs on the client side of a seam has to come through here instead.
const decodeBase64ToBytes = (base64: string): Uint8Array | null => {
	try {
		const binary =
			typeof atob === 'function'
				? atob(base64)
				: Buffer.from(base64, 'base64').toString('binary');
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) {
			bytes[index] = binary.charCodeAt(index);
		}
		return bytes;
	} catch {
		return null;
	}
};

/**
 * Whether a generated image can actually be drawn and embedded, judged from its own bytes.
 *
 * `GeneratedImageSchema` types `data` as `NonEmptyStringSchema`, so any non-empty string is a
 * contract-valid image, and `image-generation-pipeline.ts` labels bytes it cannot identify as
 * `png`. A provider returning nonempty garbage therefore reaches the UI as a well-formed PNG that
 * renders as a broken tile and makes `embedPng` throw. Callers that are about to *replace* a
 * working page need to know that before they discard it.
 */
export const isRenderableGeneratedImage = (image: GeneratedImage): boolean => {
	if (image.encoding === 'utf8') {
		return image.format === 'svg' && image.data.trim().length > 0;
	}
	const bytes = decodeBase64ToBytes(image.data);
	return bytes !== null && detectRasterMimeTypeFromBytes(bytes) !== null;
};
