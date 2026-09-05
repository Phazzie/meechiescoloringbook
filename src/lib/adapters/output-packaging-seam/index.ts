/*
 * Purpose: Canonical OutputPackagingSeam adapter implementation.
 * Why: Package generated images into downloadable PDF/PNG files client-side with safe memory chunking and browser guards.
 * Info flow: Generated images -> packaging logic (canvas/pdf-lib) -> packaged files.
 * Invariants: Input with empty images array returns NO_IMAGES; non-browser environment returns BROWSER_REQUIRED; base64 encoding chunked at 8KB to avoid call stack limits.
 */
import { PDFDocument } from 'pdf-lib';
import type {
	OutputPackagingInput,
	OutputPackagingOutput,
	OutputPackagingSeam
} from '../../seams/output-packaging-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';

const PAGE_SIZES = {
	US_Letter: { width: 612, height: 792 },
	A4: { width: 595, height: 842 }
};

const SHARE_SQUARE = 1080;
const SHARE_CHAT = 720;
const PRINT_WIDTH = 2550;
const PRINT_HEIGHT = 3300;

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
		width: widthMatch ? Number(widthMatch[1]) : PRINT_WIDTH,
		height: heightMatch ? Number(heightMatch[1]) : PRINT_HEIGHT
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

const drawImageToCanvas = async (
	dataUrl: string,
	width: number,
	height: number
): Promise<Result<string>> => {
	const guard = browserGuard('Image resizing');
	if (!guard.ok) {
		return guard;
	}
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
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
			const scale = Math.min(width / image.width, height / image.height);
			const drawWidth = image.width * scale;
			const drawHeight = image.height * scale;
			const offsetX = (width - drawWidth) / 2;
			const offsetY = (height - drawHeight) / 2;
			context.fillStyle = '#ffffff';
			context.fillRect(0, 0, width, height);
			context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
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
		return drawImageToCanvas(
			`data:image/jpeg;base64,${image.data}`,
			PRINT_WIDTH,
			PRINT_HEIGHT
		);
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
		return drawImageToCanvas(
			`data:image/webp;base64,${image.data}`,
			PRINT_WIDTH,
			PRINT_HEIGHT
		);
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

const toImageDataUrl = async (
	image: OutputPackagingInput['images'][number]
): Promise<Result<string>> => {
	if (image.format === 'svg') {
		return {
			ok: true,
			value: `data:image/svg+xml;utf8,${encodeURIComponent(image.data)}`
		};
	}
	if (image.format === 'png' && image.encoding === 'base64') {
		return { ok: true, value: `data:image/png;base64,${image.data}` };
	}
	if (image.format === 'jpg' && image.encoding === 'base64') {
		return { ok: true, value: `data:image/jpeg;base64,${image.data}` };
	}
	if (image.format === 'webp' && image.encoding === 'base64') {
		return { ok: true, value: `data:image/webp;base64,${image.data}` };
	}
	return {
		ok: false,
		error: {
			code: 'UNSUPPORTED_IMAGE_FORMAT',
			message: `Unsupported image format: ${image.format}`
		}
	};
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
					const pngResult = await imageToPngBase64(image);
					if (!pngResult.ok) {
						return pngResult;
					}
					files.push({
						filename: `${buildFilename(input.fileBaseName, index, input.images.length, '')}.png`,
						mimeType: 'image/png',
						dataBase64: pngResult.value
					});
				} else {
					const pageSize = PAGE_SIZES[input.pageSize];
					const pdfDoc = await PDFDocument.create();
					const page = pdfDoc.addPage([pageSize.width, pageSize.height]);
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
					const scale = Math.min(
						pageSize.width / embeddedImage.width,
						pageSize.height / embeddedImage.height
					);
					const width = embeddedImage.width * scale;
					const height = embeddedImage.height * scale;
					page.drawImage(embeddedImage, {
						x: (pageSize.width - width) / 2,
						y: (pageSize.height - height) / 2,
						width,
						height
					});
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
