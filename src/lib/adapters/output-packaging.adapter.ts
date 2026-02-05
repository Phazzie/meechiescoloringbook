// Purpose: Adapter implementation for OutputPackagingSeam.
// Why: Package generated images into downloadable PDF/PNG files client-side.
// Info flow: Generated images -> packaged files -> UI downloads.
import { PDFDocument } from 'pdf-lib';
import type {
	OutputPackagingInput,
	OutputPackagingOutput,
	OutputPackagingSeam
} from '../../../contracts/output-packaging.contract';
import type { Result } from '../../../contracts/shared.contract';

const PAGE_SIZES = {
	US_Letter: { width: 612, height: 792 },
	A4: { width: 595, height: 842 }
};

const SHARE_SQUARE = 1080;
const SHARE_CHAT = 720;

const toBase64 = (bytes: Uint8Array): string => {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
};

const fromBase64 = (base64: string): Uint8Array => {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
};

const parseSvgSize = (svg: string): { width: number; height: number } => {
	const widthMatch = svg.match(/width="(\d+(?:\.\d+)?)"/);
	const heightMatch = svg.match(/height="(\d+(?:\.\d+)?)"/);
	return {
		width: widthMatch ? Number(widthMatch[1]) : 2550,
		height: heightMatch ? Number(heightMatch[1]) : 3300
	};
};

const svgToPngBase64 = async (svg: string): Promise<Result<string>> => {
	if (typeof document === 'undefined' || typeof Image === 'undefined') {
		return {
			ok: false,
			error: {
				code: 'BROWSER_REQUIRED',
				message: 'SVG conversion requires a browser environment.'
			}
		};
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

const imageToPngBase64 = async (image: OutputPackagingInput['images'][number]): Promise<Result<string>> => {
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
		return { ok: true, value: `data:image/svg+xml;utf8,${encodeURIComponent(image.data)}` };
	}
	if (image.format === 'png' && image.encoding === 'base64') {
		return { ok: true, value: `data:image/png;base64,${image.data}` };
	}
	return {
		ok: false,
		error: {
			code: 'UNSUPPORTED_IMAGE_FORMAT',
			message: `Unsupported image format: ${image.format}`
		}
	};
};

const drawImageToCanvas = async (dataUrl: string, width: number, height: number): Promise<Result<string>> => {
	if (typeof document === 'undefined' || typeof Image === 'undefined') {
		return {
			ok: false,
			error: {
				code: 'BROWSER_REQUIRED',
				message: 'Image resizing requires a browser environment.'
			}
		};
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

const buildFilename = (base: string, index: number, total: number, suffix: string): string => {
	const indexSuffix = total > 1 ? `-${index + 1}` : '';
	const variantSuffix = suffix.length > 0 ? `-${suffix}` : '';
	return `${base}${indexSuffix}${variantSuffix}`;
};

export const outputPackagingAdapter: OutputPackagingSeam = {
	package: async (input: OutputPackagingInput): Promise<Result<OutputPackagingOutput>> => {
		if (input.images.length === 0) {
			return {
				ok: false,
				error: {
					code: 'NO_IMAGES',
					message: 'No images provided for packaging.'
				}
			};
		}

		const variants = input.variants && input.variants.length > 0 ? input.variants : ['print'];
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
					const pngResult = await imageToPngBase64(image);
					if (!pngResult.ok) {
						return pngResult;
					}
					const pngBytes = fromBase64(pngResult.value);
					const pdfDoc = await PDFDocument.create();
					const page = pdfDoc.addPage([pageSize.width, pageSize.height]);
					const pngImage = await pdfDoc.embedPng(pngBytes);
					const scale = Math.min(
						pageSize.width / pngImage.width,
						pageSize.height / pngImage.height
					);
					const width = pngImage.width * scale;
					const height = pngImage.height * scale;
					page.drawImage(pngImage, {
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
