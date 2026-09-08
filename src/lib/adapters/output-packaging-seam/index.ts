/*
 * Purpose: Canonical OutputPackagingSeam adapter implementation.
 * Why: Package generated images into downloadable PDF/PNG files client-side with safe memory chunking and browser guards.
 * Info flow: Generated images -> `planPrintPlacement` (pure, in core) -> canvas/pdf-lib renderers -> packaged files.
 * Invariants: Input with empty images array returns NO_IMAGES; non-browser environment returns BROWSER_REQUIRED; base64 encoding chunked at 8KB to avoid call stack limits.
 *   Every `print` artifact — PDF and PNG alike — is placed by `planPrintPlacement`, so both carry the
 *   same blank margin as each other and as the browser print path. This file decides no geometry of
 *   its own: it holds a canvas and a PDF page, and asks core where the ink goes. The share variants
 *   (`square`, `chat`) deliberately do not go through it — they fill their canvas edge to edge
 *   because they are for posting and sending, not for paper.
 */
import { PDFDocument } from 'pdf-lib';
import type {
	OutputPackagingInput,
	OutputPackagingOutput,
	OutputPackagingSeam
} from '../../seams/output-packaging-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';
import {
	planPrintPlacement,
	placementToPx,
	printCanvasPx,
	PAGE_DIMENSIONS_PT
} from '../../core/print-layout';
import type { PrintRect } from '../../core/print-layout';

const SHARE_SQUARE = 1080;
const SHARE_CHAT = 720;

/**
 * The rasterisation size used when an SVG declares neither dimensions nor a usable viewBox.
 *
 * Unchanged in value from the `2550 x 3300` this file used to hardcode — it is now derived from the
 * same page geometry everything else uses, so there is one place that knows what 300dpi US Letter
 * is. It is only a canvas size for a sizeless SVG; where the resulting raster lands on the paper is
 * `planPrintPlacement`'s decision, not this constant's.
 */
const SVG_FALLBACK_CANVAS = printCanvasPx('US_Letter');

const CHUNK_SIZE = 8192;

export const toBase64 = (bytes: Uint8Array): string => {
	let binary = '';
	for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
		const chunk = bytes.subarray(i, i + CHUNK_SIZE);
		binary += String.fromCharCode(...chunk);
	}
	return btoa(binary);
};

export const fromBase64 = (base64: string): Uint8Array => {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
};

export const parseSvgSize = (svg: string): { width: number; height: number } => {
	const widthMatch = svg.match(/\bwidth="(\d+(?:\.\d+)?)"/i);
	const heightMatch = svg.match(/\bheight="(\d+(?:\.\d+)?)"/i);

	if (widthMatch && heightMatch) {
		return {
			width: Number(widthMatch[1]),
			height: Number(heightMatch[1])
		};
	}

	// Parse viewBox="min-x min-y width height"
	const viewBoxMatch = svg.match(/\bviewBox="[0-9.-]+\s+[0-9.-]+\s+([0-9.-]+)\s+([0-9.-]+)"/i);
	if (viewBoxMatch) {
		const vbWidth = Number(viewBoxMatch[1]);
		const vbHeight = Number(viewBoxMatch[2]);
		if (vbWidth > 0 && vbHeight > 0) {
			if (widthMatch) {
				const w = Number(widthMatch[1]);
				return { width: w, height: (w / vbWidth) * vbHeight };
			}
			if (heightMatch) {
				const h = Number(heightMatch[1]);
				return { width: (h / vbHeight) * vbWidth, height: h };
			}
			return { width: vbWidth, height: vbHeight };
		}
	}

	return {
		width: widthMatch ? Number(widthMatch[1]) : SVG_FALLBACK_CANVAS.width,
		height: heightMatch ? Number(heightMatch[1]) : SVG_FALLBACK_CANVAS.height
	};
};

const browserGuard = (operation: string): Result<void> => {
	if (typeof document === 'undefined' || typeof Image === 'undefined') {
		return {
			ok: false,
			error: {
				code: 'BROWSER_REQUIRED',
				message: `${operation} requires a browser environment.`
			}
		};
	}
	return { ok: true, value: undefined };
};

const svgToPngBase64 = async (svg: string): Promise<Result<string>> => {
	const guard = browserGuard('SVG conversion');
	if (!guard.ok) {
		return guard;
	}

	const { width, height } = parseSvgSize(svg);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	if (!context) {
		return {
			ok: false,
			error: {
				code: 'CANVAS_UNAVAILABLE',
				message: 'Canvas context unavailable for SVG conversion.'
			}
		};
	}

	const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
	const url = URL.createObjectURL(svgBlob);

	const base64Result = await new Promise<Result<string>>((resolve) => {
		const image = new Image();
		image.onload = () => {
			context.fillStyle = '#ffffff';
			context.fillRect(0, 0, width, height);
			context.drawImage(image, 0, 0, width, height);
			URL.revokeObjectURL(url);
			const dataUrl = canvas.toDataURL('image/png');
			const base64 = dataUrl.split(',')[1] || '';
			if (base64.length === 0) {
				resolve({
					ok: false,
					error: {
						code: 'PNG_ENCODING_FAILED',
						message: 'Failed to encode PNG data.'
					}
				});
				return;
			}
			resolve({ ok: true, value: base64 });
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			resolve({
				ok: false,
				error: {
					code: 'SVG_IMAGE_LOAD_FAILED',
					message: 'Failed to load SVG image for conversion.'
				}
			});
		};
		image.src = url;
	});

	return base64Result;
};

/** How big a canvas to make, and where on it the image goes. */
type CanvasPlan = {
	canvas: { width: number; height: number };
	target: PrintRect;
};

/**
 * Draw one loaded image onto a fresh canvas and return the PNG bytes.
 *
 * `plan` decides both the canvas and the placement, and is given the image's own intrinsic size
 * because two of the three callers need it: the print path plans against it, and the native
 * transcode *is* it. The canvas is painted white first in every case — a coloring page is line art
 * on transparency, and transparency prints as whatever the viewer feels like.
 */
const drawOnCanvas = async (
	dataUrl: string,
	plan: (source: { width: number; height: number }) => CanvasPlan
): Promise<Result<string>> => {
	const guard = browserGuard('Image resizing');
	if (!guard.ok) {
		return guard;
	}

	// The canvas is made and its context taken *before* the image is loaded, even though its size is
	// not known until after. An environment without canvas support has to fail here rather than
	// inside `onload`: `Image` never fires `load` in jsdom, so a context check that waits for the
	// image never runs at all and the packaging call hangs instead of returning CANVAS_UNAVAILABLE.
	// Twenty of this repo's own tests time out at five seconds each when this check moves down.
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	if (!context) {
		return {
			ok: false,
			error: {
				code: 'CANVAS_UNAVAILABLE',
				message: 'Canvas context unavailable for resizing.'
			}
		};
	}

	const base64Result = await new Promise<Result<string>>((resolve) => {
		const image = new Image();
		image.onload = () => {
			// Planned after load: two of the three callers size the canvas from the image's own
			// intrinsic dimensions, which do not exist until here. Assigning `width`/`height` resets
			// the canvas, which is why the white fill below comes after it and not before.
			const { canvas: canvasSize, target } = plan({
				width: image.width,
				height: image.height
			});
			canvas.width = canvasSize.width;
			canvas.height = canvasSize.height;
			context.fillStyle = '#ffffff';
			context.fillRect(0, 0, canvasSize.width, canvasSize.height);
			context.drawImage(image, target.x, target.y, target.width, target.height);
			const pngDataUrl = canvas.toDataURL('image/png');
			const base64 = pngDataUrl.split(',')[1] || '';
			if (base64.length === 0) {
				resolve({
					ok: false,
					error: {
						code: 'PNG_ENCODING_FAILED',
						message: 'Failed to encode PNG data.'
					}
				});
				return;
			}
			resolve({ ok: true, value: base64 });
		};
		image.onerror = () => {
			resolve({
				ok: false,
				error: {
					code: 'IMAGE_RESIZE_FAILED',
					message: 'Failed to load image for resizing.'
				}
			});
		};
		image.src = dataUrl;
	});

	return base64Result;
};

/**
 * Letterbox an image to fill a canvas, centred — the share variants' geometry.
 *
 * Edge to edge on the long axis by design: `square` and `chat` are for a feed and a chat bubble,
 * where a reserved white border is wasted pixels, not a margin to hold.
 */
const fillCentred = (
	canvasSize: { width: number; height: number },
	source: { width: number; height: number }
): PrintRect => {
	// A source that failed to decode reports zero, and `0 / 0` is `NaN` — which reaches
	// `drawImage` as a silent no-op and produces a blank share image rather than an error.
	// `planPrintPlacement` guards the same case on the print side; this is the share side of it.
	const usable =
		Number.isFinite(source.width) &&
		Number.isFinite(source.height) &&
		source.width > 0 &&
		source.height > 0;
	if (!usable) {
		return { x: 0, y: 0, width: canvasSize.width, height: canvasSize.height };
	}
	const scale = Math.min(
		canvasSize.width / source.width,
		canvasSize.height / source.height
	);
	const width = source.width * scale;
	const height = source.height * scale;
	return {
		x: (canvasSize.width - width) / 2,
		y: (canvasSize.height - height) / 2,
		width,
		height
	};
};

/** Resize an image to fill a canvas of exactly this size, centred — the share variants' renderer. */
const drawImageToCanvas = async (
	dataUrl: string,
	width: number,
	height: number
): Promise<Result<string>> =>
	drawOnCanvas(dataUrl, (source) => ({
		canvas: { width, height },
		target: fillCentred({ width, height }, source)
	}));

/**
 * Re-encode an image as PNG at its own resolution, changing nothing but the container.
 *
 * Used to get bytes `pdf-lib` can embed out of a format it cannot read. It deliberately does not
 * resize: this used to letterbox JPG and WebP sources onto a fixed 2550 x 3300 portrait canvas
 * before embedding, which baked white bars into the image and then let the PDF letterbox those bars
 * a second time. Where the artwork sits on the paper is `planPrintPlacement`'s decision, and it can
 * only make it correctly if what it is given is the picture rather than the picture inside a
 * previous layout.
 */
const transcodeToPngBase64 = async (
	dataUrl: string
): Promise<Result<string>> =>
	drawOnCanvas(dataUrl, (source) => ({
		canvas: source,
		target: { x: 0, y: 0, width: source.width, height: source.height }
	}));

/**
 * PNG bytes for an image, at its native resolution.
 *
 * A PNG source is passed through untouched — it is already what is being asked for, and re-encoding
 * it would be a generation loss for nothing.
 */
const imageToPngBase64 = async (
	image: OutputPackagingInput['images'][number]
): Promise<Result<string>> => {
	if (image.format === 'png') {
		if (image.encoding !== 'base64') {
			return {
				ok: false,
				error: {
					code: 'PNG_ENCODING_UNSUPPORTED',
					message: 'PNG data must be base64 encoded.'
				}
			};
		}
		return { ok: true, value: image.data };
	}

	if (image.format === 'jpg') {
		if (image.encoding !== 'base64') {
			return {
				ok: false,
				error: {
					code: 'JPG_ENCODING_UNSUPPORTED',
					message: 'JPG data must be base64 encoded.'
				}
			};
		}
		return transcodeToPngBase64(`data:image/jpeg;base64,${image.data}`);
	}

	if (image.format === 'webp') {
		if (image.encoding !== 'base64') {
			return {
				ok: false,
				error: {
					code: 'WEBP_ENCODING_UNSUPPORTED',
					message: 'WebP data must be base64 encoded.'
				}
			};
		}
		return transcodeToPngBase64(`data:image/webp;base64,${image.data}`);
	}

	if (image.format === 'svg') {
		return svgToPngBase64(image.data);
	}

	return {
		ok: false,
		error: {
			code: 'UNSUPPORTED_IMAGE_FORMAT',
			message: `Unsupported image format: ${image.format}`
		}
	};
};

/**
 * The contract's three raster formats, named once.
 *
 * `GeneratedImageSchema`'s `format` also includes `svg`, which is handled separately everywhere
 * below because it is markup rather than pixels and has no `data:`-URL base64 form.
 */
type RasterFormat = 'png' | 'jpg' | 'webp';

/**
 * The media types the raster formats are addressed by in a `data:` URL.
 *
 * `jpg` is the contract's name for the format; `image/jpeg` is the browser's.
 */
const RASTER_MEDIA_TYPES: Record<RasterFormat, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	webp: 'image/webp'
};

/** The error code each raster format reports when its payload is not base64. */
const ENCODING_ERROR_CODES: Record<RasterFormat, string> = {
	png: 'PNG_ENCODING_UNSUPPORTED',
	jpg: 'JPG_ENCODING_UNSUPPORTED',
	webp: 'WEBP_ENCODING_UNSUPPORTED'
};

const toImageDataUrl = async (
	image: OutputPackagingInput['images'][number]
): Promise<Result<string>> => {
	if (image.format === 'svg') {
		return {
			ok: true,
			value: `data:image/svg+xml;utf8,${encodeURIComponent(image.data)}`
		};
	}

	const mediaType = RASTER_MEDIA_TYPES[image.format as RasterFormat];
	if (mediaType === undefined) {
		return {
			ok: false,
			error: {
				code: 'UNSUPPORTED_IMAGE_FORMAT',
				message: `Unsupported image format: ${image.format}`
			}
		};
	}

	// A recognised format whose payload is not base64 is an encoding problem, and it used to be
	// reported here as `UNSUPPORTED_IMAGE_FORMAT` — which names the wrong thing: the format is
	// supported, the encoding is not. `imageToPngBase64` already distinguished the two; this path
	// (the share variants, and now the print raster) fell through to the generic code for all three
	// formats at once.
	if (image.encoding !== 'base64') {
		return {
			ok: false,
			error: {
				code: ENCODING_ERROR_CODES[image.format as RasterFormat],
				message: `${image.format.toUpperCase()} data must be base64 encoded.`
			}
		};
	}

	return { ok: true, value: `data:${mediaType};base64,${image.data}` };
};

const imageToPngBase64Sized = async (
	image: OutputPackagingInput['images'][number],
	size: number
): Promise<Result<string>> => {
	const dataUrlResult = await toImageDataUrl(image);
	if (!dataUrlResult.ok) {
		return dataUrlResult;
	}
	return drawImageToCanvas(dataUrlResult.value, size, size);
};

/**
 * The `print` variant as a raster: a whole sheet of paper at print resolution, with the artwork
 * placed inside the same safe margin the PDF uses.
 *
 * A full sheet rather than a cropped picture, so the PNG and the PDF are one page rendered twice
 * instead of two different layouts. Before this, the PNG print variant did not resize a PNG source
 * at all — it returned the provider's own bytes — while a JPG or WebP source was letterboxed onto a
 * fixed 2550 x 3300 canvas, so the same coloring page came out 1024 x 1024 or 2550 x 3300 depending
 * only on which format the provider happened to answer with. The reader who wants the untouched
 * bytes still has them: that is the `original` download, which is not built here.
 */
const imageToPrintSheetPng = async (
	image: OutputPackagingInput['images'][number],
	pageSize: OutputPackagingInput['pageSize']
): Promise<Result<string>> => {
	const dataUrlResult = await toImageDataUrl(image);
	if (!dataUrlResult.ok) {
		return dataUrlResult;
	}
	const canvas = printCanvasPx(pageSize);
	return drawOnCanvas(dataUrlResult.value, (source) => ({
		canvas,
		target: placementToPx(planPrintPlacement(source, pageSize))
	}));
};

const buildFilename = (
	base: string,
	index: number,
	total: number,
	suffix: string
): string => {
	const indexSuffix = total > 1 ? `-${index + 1}` : '';
	const variantSuffix = suffix.length > 0 ? `-${suffix}` : '';
	return `${base}${indexSuffix}${variantSuffix}`;
};

export const outputPackagingAdapter: OutputPackagingSeam = {
	package: async (
		input: OutputPackagingInput
	): Promise<Result<OutputPackagingOutput>> => {
		if (input.images.length === 0) {
			return {
				ok: false,
				error: {
					code: 'NO_IMAGES',
					message: 'No images provided for packaging.'
				}
			};
		}

		const variants =
			input.variants && input.variants.length > 0 ? input.variants : ['print'];
		const files: OutputPackagingOutput['files'] = [];

		for (let index = 0; index < input.images.length; index += 1) {
			const image = input.images[index];

			if (variants.includes('print')) {
				if (input.outputFormat === 'png') {
					const pngResult = await imageToPrintSheetPng(image, input.pageSize);
					if (!pngResult.ok) {
						return pngResult;
					}
					files.push({
						filename: `${buildFilename(input.fileBaseName, index, input.images.length, '')}.png`,
						mimeType: 'image/png',
						dataBase64: pngResult.value
					});
				} else {
					const paper = PAGE_DIMENSIONS_PT[input.pageSize];
					const pdfDoc = await PDFDocument.create();
					const page = pdfDoc.addPage([paper.width, paper.height]);
					let embeddedImage;
					if (image.format === 'jpg' && image.encoding === 'base64') {
						embeddedImage = await pdfDoc.embedJpg(fromBase64(image.data));
					} else {
						const pngResult = await imageToPngBase64(image);
						if (!pngResult.ok) {
							return pngResult;
						}
						embeddedImage = await pdfDoc.embedPng(fromBase64(pngResult.value));
					}
					// The one geometry decision, made in core and taken verbatim. `pdf-lib` measures
					// y up from the bottom of the sheet, which is the origin `planPrintPlacement`
					// reports in, so no conversion belongs here.
					const { image: placed } = planPrintPlacement(
						{ width: embeddedImage.width, height: embeddedImage.height },
						input.pageSize
					);
					page.drawImage(embeddedImage, placed);
					const pdfBytes = await pdfDoc.save();
					files.push({
						filename: `${buildFilename(input.fileBaseName, index, input.images.length, '')}.pdf`,
						mimeType: 'application/pdf',
						dataBase64: toBase64(pdfBytes)
					});
				}
			}

			if (variants.includes('square')) {
				const squareResult = await imageToPngBase64Sized(image, SHARE_SQUARE);
				if (!squareResult.ok) {
					return squareResult;
				}
				files.push({
					filename: `${buildFilename(input.fileBaseName, index, input.images.length, 'square')}.png`,
					mimeType: 'image/png',
					dataBase64: squareResult.value
				});
			}

			if (variants.includes('chat')) {
				const chatResult = await imageToPngBase64Sized(image, SHARE_CHAT);
				if (!chatResult.ok) {
					return chatResult;
				}
				files.push({
					filename: `${buildFilename(input.fileBaseName, index, input.images.length, 'chat')}.png`,
					mimeType: 'image/png',
					dataBase64: chatResult.value
				});
			}
		}

		return { ok: true, value: { files } };
	}
};
