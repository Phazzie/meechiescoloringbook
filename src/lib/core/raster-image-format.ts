// Purpose: Detect a raster image's real MIME type from its byte signature.
// Why: A base64-string-prefix guess silently mislabels anything it doesn't recognize (e.g. a
//      real WebP response defaulting to PNG); this exact byte-signature check was independently
//      duplicated across the wig-try-on pipeline/adapter and the image-generation pipeline, so it
//      now lives in one place both can import.
// Info flow: raw bytes or a base64 string -> byte-signature match -> a RasterMimeType, or null.

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
