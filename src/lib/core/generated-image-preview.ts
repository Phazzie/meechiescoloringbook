// Purpose: Turn a `GeneratedImage` into something a browser can show, and into the base64 bytes
//          the creation store keeps.
// Why: The same twenty-line MIME map and `data:` URL builder was copied into four components
//      (`MeechieTools.svelte` and the three standalone mode routes). Four copies of a conversion
//      is four places for the SVG special case to be forgotten, and the vault's base64 requirement
//      was already only implemented in one of them.
// Info flow: GeneratedImage -> data URL for <img src>, or -> base64 string for CreationRecord.images.
// Deliberately the flat contract, not `src/lib/seams/image-generation-seam/contract`. Both export
// a type called `GeneratedImage` and they are different shapes: the seam's is `{ id, url?, b64? }`
// (what a provider hands back), while this one is `{ id, format, mimeType, data, encoding }` —
// the decoded image `/api/generate` returns and the only one that carries the format and encoding
// this module switches on.
import type { GeneratedImage } from '../../../contracts/image-generation.contract';

/**
 * The media type for each value of the image contract's `format` enum.
 *
 * `format` is the only image-type field the contract actually constrains: it is a closed
 * four-value enum, while `mimeType` is `NonEmptyStringSchema`, so any non-empty string passes
 * validation. Deriving the media type from the enum is therefore total — it can never emit
 * `undefined` — and it cannot forward an unvalidated wire value. It also emits the registered
 * `image/jpeg` and `image/svg+xml` names rather than the non-standard `image/jpg` and `image/svg`
 * that interpolating the enum member produced.
 */
export const GENERATED_IMAGE_MIME_TYPES: Record<
	GeneratedImage['format'],
	string
> = {
	svg: 'image/svg+xml',
	png: 'image/png',
	jpg: 'image/jpeg',
	webp: 'image/webp'
};

/**
 * Build a `data:` URL for an image, or null when the encoding is one no URL can carry.
 *
 * SVG arrives as utf8 markup and is percent-encoded rather than base64'd, matching what the
 * packaging adapter expects to receive back. A utf8 payload in any raster format is the one case
 * with no representation here: returning null drops that image from the preview grid instead of
 * rendering a broken `<img>`.
 */
export const generatedImageDataUrl = (image: GeneratedImage): string | null => {
	if (image.format === 'svg' && image.encoding === 'utf8') {
		return `data:${GENERATED_IMAGE_MIME_TYPES.svg};utf8,${encodeURIComponent(image.data)}`;
	}
	if (image.encoding === 'base64') {
		return `data:${GENERATED_IMAGE_MIME_TYPES[image.format]};base64,${image.data}`;
	}
	return null;
};

/**
 * The base64 bytes for an image, encoding utf8 markup on the way if needed.
 *
 * `CreationImageSchema` stores `b64` and nothing else, so a utf8 SVG saved as-is would come back
 * from the vault as base64-decoded nonsense. Encoding per byte — `TextEncoder` first, then `btoa`
 * over the resulting latin1 string — is what makes a non-ASCII SVG survive; `btoa` alone throws on
 * any code point above 0xFF, which is every curly quote Meechie's voice puts in a page title.
 */
export const generatedImageBase64 = (image: GeneratedImage): string => {
	if (image.encoding === 'base64') return image.data;
	const bytes = new TextEncoder().encode(image.data);
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
};
