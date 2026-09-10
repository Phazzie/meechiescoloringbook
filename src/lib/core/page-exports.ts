// Purpose: Describe every file a finished coloring page can be taken away as, and say what could
//          not be built.
// Why: The studio's download row rendered a single hardcoded string — "Download PDF" — once per
//      file the packaging seam returned, so every link said the same thing whatever was behind it,
//      and a packaging failure was written into `generationError`, the same field an image
//      generation failure uses. That made "your page is fine, its PDF is not" render identically to
//      "your page failed", above a perfectly good page, whose most natural response is to pay for
//      another generation over a free client-side step.
// Info flow: packaging attempts (the variant asked for, the files that came back, the classified
//            failure if any) -> described downloads for the export row + what is missing and
//            whether it can be built again.
//
// The variant is carried in from the call site that asked for it rather than recovered from the
// filename. Sniffing `-square` out of a filename would be a second, weaker answer to a question the
// caller already knows the answer to, and would start disagreeing the moment `fileBaseName` changes.
//
// An attempt's failure is a classified `ExportFailure`, never a string. It used to be the seam's own
// `message`, quoted verbatim into the reader's sentence — so the one sentence this module wrote for
// a reader was half authored here and half written for whoever wrote the adapter. Every word a
// reader sees about a failed download is now `export-failure.ts`'s, and the seam's words go where an
// exception's words go.
import type { PackagedFile, OutputVariant } from '../seams/output-packaging-seam/contract';
import type { ExportFailure } from './export-failure';
import type { ColoringPageSpec } from '../../../contracts/spec-validation.contract';
import type { GeneratedImage } from '../../../contracts/image-generation.contract';
import {
	GENERATED_IMAGE_MIME_TYPES,
	generatedImageDataUrl
} from './generated-image-preview';

/**
 * What a download is, from the reader's side.
 *
 * The three packaging variants plus `original` — the provider's own bytes, which are what the
 * preview is showing and the only download that involves no re-rendering at all.
 */
export type PageExportKind = OutputVariant | 'original';

/** One row of the export bar: a link, and everything needed to say what is behind it. */
export type PageExport = {
	kind: PageExportKind;
	filename: string;
	mimeType: string;
	/** `data:` URL the download link points at. */
	href: string;
	/** What this file is, e.g. "Printable PDF". */
	label: string;
	/** What it is for, e.g. "US Letter — ready to print". */
	purpose: string;
	/** Human-readable size, e.g. "412 KB". */
	sizeLabel: string;
	byteLength: number;
};

/** One call to the packaging seam: what was asked for, and what came back. */
export type PageExportAttempt = {
	variant: OutputVariant;
	files: PackagedFile[];
	/**
	 * Why the variant could not be built, classified, or `null` when it was.
	 *
	 * Was the seam's own `message`. A string could only ever answer "what happened", badly — it could
	 * not say whether building it again was worth the reader's time, which is the question a free,
	 * local, already-paid-for step most needs answered.
	 */
	failure: ExportFailure | null;
	/**
	 * The paper this attempt was packaged for.
	 *
	 * Carried on the attempt rather than passed alongside it, because it is a fact about the files
	 * that came back and the caller's live value is a different thing. Describing the row from the
	 * live spec labelled a US Letter PDF "A4 — ready to print" whenever the reader moved Page Size
	 * while a generation was in flight. Keeping it here removes the drift rather than relocating it:
	 * there is no second page size for the label to disagree with.
	 */
	pageSize: ColoringPageSpec['pageSize'];
};

const FILE_TYPE_LABELS: Record<string, string> = {
	'application/pdf': 'PDF',
	'image/png': 'PNG',
	'image/jpeg': 'JPG',
	'image/webp': 'WEBP',
	'image/svg+xml': 'SVG'
};

/**
 * The short name for a media type, e.g. `image/jpeg` -> `JPG`.
 *
 * `PackagedFileSchema` types `mimeType` as any non-empty string, so this has to be total over
 * strings rather than over an enum; an unrecognised type gets the honest fallback instead of a
 * guess, because a label that names the wrong format is worse than one that names none.
 */
export const fileTypeLabel = (mimeType: string): string =>
	FILE_TYPE_LABELS[mimeType.toLowerCase()] ?? 'File';

const PAGE_SIZE_LABELS: Record<ColoringPageSpec['pageSize'], string> = {
	US_Letter: 'US Letter',
	A4: 'A4'
};

const IMAGE_FILE_EXTENSIONS: Record<GeneratedImage['format'], string> = {
	svg: 'svg',
	png: 'png',
	jpg: 'jpg',
	webp: 'webp'
};

/**
 * What each variant is for.
 *
 * Deliberately free of pixel dimensions. The share sizes are module-private constants inside
 * `src/lib/adapters/output-packaging-seam/index.ts`; restating "1080 x 1080" here would be a claim
 * this module cannot check, in a codebase that has already been bitten by prose drifting away from
 * the code it describes. The purpose a reader actually needs — which file to grab — survives
 * without the number.
 */
const VARIANT_PURPOSES: Record<OutputVariant, string> = {
	print: 'ready to print',
	square: 'square crop — for posting',
	chat: 'smaller square — for sending'
};

const VARIANT_LABEL_PREFIXES: Record<OutputVariant, string> = {
	print: 'Printable',
	square: 'Square',
	chat: 'Chat'
};

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;

/**
 * The decoded size of a base64 payload, computed from the encoded length.
 *
 * Measured rather than decoded: a printable page is megabytes of base64, and `atob`-ing all of it to
 * read `.length` would allocate the whole thing again on every render of the export row. Whitespace
 * is stripped first because base64 from other producers may be line-wrapped, and `=` padding is
 * subtracted because each padding character stands for a byte that is not there.
 */
export const base64ByteLength = (base64: string): number => {
	const compact = base64.replace(/\s/g, '');
	if (compact.length === 0) return 0;
	const padding = /(={1,2})$/.exec(compact)?.[1].length ?? 0;
	return Math.max(0, Math.floor((compact.length * 3) / 4) - padding);
};

/**
 * A size a reader can read, e.g. `412 KB`.
 *
 * Formatted by hand rather than through `Intl.NumberFormat`, so the string is identical in every
 * locale. The wig studio already had to pin a locale for exactly this reason — a browser-locale
 * format showed `89,99 $` beside the carousel's `$89.99` for the same wig.
 */
export const formatByteSize = (bytes: number): string => {
	const safe = Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : 0;
	if (safe < BYTES_PER_KB) return `${safe} B`;
	if (safe < BYTES_PER_MB) return `${Math.round(safe / BYTES_PER_KB)} KB`;
	return `${(safe / BYTES_PER_MB).toFixed(1)} MB`;
};

/** Describe one packaged file, using the variant the caller asked the seam for. */
export const describePackagedExport = (
	variant: OutputVariant,
	file: PackagedFile,
	pageSize: ColoringPageSpec['pageSize']
): PageExport => {
	const byteLength = base64ByteLength(file.dataBase64);
	const purpose =
		variant === 'print'
			? `${PAGE_SIZE_LABELS[pageSize]} — ${VARIANT_PURPOSES.print}`
			: VARIANT_PURPOSES[variant];
	return {
		kind: variant,
		filename: file.filename,
		mimeType: file.mimeType,
		href: `data:${file.mimeType};base64,${file.dataBase64}`,
		label: `${VARIANT_LABEL_PREFIXES[variant]} ${fileTypeLabel(file.mimeType)}`,
		purpose,
		sizeLabel: formatByteSize(byteLength),
		byteLength
	};
};

/** Describe every file that was successfully packaged, in the order the variants were requested. */
export const describePackagedExports = (attempts: readonly PageExportAttempt[]): PageExport[] =>
	attempts.flatMap((attempt) =>
		attempt.files.map((file) => describePackagedExport(attempt.variant, file, attempt.pageSize))
	);

/**
 * The size of a generated image's payload in bytes.
 *
 * SVG arrives as utf8 markup rather than base64, and its byte count is not its character count the
 * moment a page title carries a curly quote — so it is measured as encoded bytes, not `.length`.
 */
export const generatedImageByteLength = (image: GeneratedImage): number =>
	image.encoding === 'base64'
		? base64ByteLength(image.data)
		: new TextEncoder().encode(image.data).length;

/**
 * Describe the provider's own image as a download, or `null` when its encoding has no `data:` URL.
 *
 * This is the one download that is not a re-render, so it is the only way to get the exact bytes the
 * preview is showing. It takes a `-original` suffix so it can never collide with a packaged file of
 * the same type — which is also what stops the export row needing a key that might not be unique.
 */
export const describeOriginalImageExport = (
	image: GeneratedImage | null | undefined,
	fileBaseName: string
): PageExport | null => {
	if (!image) return null;
	const href = generatedImageDataUrl(image);
	if (href === null) return null;
	const byteLength = generatedImageByteLength(image);
	const mimeType = GENERATED_IMAGE_MIME_TYPES[image.format];
	return {
		kind: 'original',
		filename: `${fileBaseName}-original.${IMAGE_FILE_EXTENSIONS[image.format]}`,
		mimeType,
		href,
		label: `Original ${fileTypeLabel(mimeType)}`,
		purpose: 'exactly what the generator sent',
		sizeLabel: formatByteSize(byteLength),
		byteLength
	};
};

/** Every variant that could not be built, in the order they were requested. */
export const pageExportFailures = (
	attempts: readonly PageExportAttempt[]
): ExportFailure[] =>
	attempts
		.map((attempt) => attempt.failure)
		.filter((failure): failure is ExportFailure => failure !== null);

/**
 * The variants a rebuild should ask for: the ones that failed, and only those.
 *
 * A rebuild that re-packaged everything could **take away a download the reader already has**. The
 * commonest failure here is memory on a page that is several megapixels at print resolution, and the
 * commonest shape of it is "the PDF built, the 1080px share canvas did not". Re-running the PDF in
 * that state risks losing it to the same pressure that broke the square — turning the one control
 * offered against a partial failure into a way to make it total. It is also simply wasted work: the
 * successful attempt already holds its files.
 */
export const failedExportVariants = (
	attempts: readonly PageExportAttempt[]
): OutputVariant[] =>
	attempts
		.filter((attempt) => attempt.failure !== null)
		.map((attempt) => attempt.variant);

/**
 * Put rebuilt attempts back among the ones that were kept, in the original request order.
 *
 * Matched by variant rather than by position, because a rebuild asks for a subset. An attempt with
 * no replacement is returned untouched — that is the successful download the rebuild deliberately
 * did not re-run.
 */
export const mergeRebuiltAttempts = (
	previous: readonly PageExportAttempt[],
	rebuilt: readonly PageExportAttempt[]
): PageExportAttempt[] =>
	previous.map(
		(attempt) =>
			rebuilt.find((replacement) => replacement.variant === attempt.variant) ??
			attempt
	);

/**
 * The line the notice opens with, or `''` when nothing failed.
 *
 * Always affirms the page itself first, because that is the fact the reader most needs and the one
 * the original wording destroyed: packaging runs after the image exists, so a failure here never
 * means the generation failed, and a notice that reads like it did invites the reader to spend
 * another generation fixing a free local step.
 */
export const summarisePageExportFailures = (
	attempts: readonly PageExportAttempt[]
): string => (pageExportFailures(attempts).length === 0 ? '' : 'Your page is on the paper.');

/**
 * How each built variant is named when the notice lists what the reader still has.
 *
 * The past tense of `SUBJECT` in `export-failure.ts`: those name a *request* that failed and so
 * cannot name a file type, while these name files that demonstrably exist.
 */
const SURVIVOR_NOUNS: Record<OutputVariant, string> = {
	print: 'the printable download',
	square: 'the square share image',
	chat: 'the chat-sized image'
};

/** Join a list the way a sentence does: `a`, `a and b`, `a, b and c`. */
const asSentenceList = (items: readonly string[]): string => {
	if (items.length <= 1) return items[0] ?? '';
	return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};

/**
 * One sentence naming what the reader still has, or `''` when there is nothing to name.
 *
 * **Measured, never assumed.** This started life inside `classifyExportFailure`, as a per-variant
 * constant: the square's failure said "the printable download and the original image are
 * unaffected". That is a claim about an attempt the classifier never sees, and it is **false
 * whenever both variants fail** — which a WebP or SVG source hitting `CANVAS_UNAVAILABLE` does,
 * because that print path transcodes through the very canvas the share renderer could not get. A
 * reader whose page produced no downloads at all was told one of them was fine.
 *
 * So it is derived here, from attempts that actually came back, and it names only files that exist.
 *
 * Print is mentioned separately and last, because it is not a download: it is `window.print()` over
 * the layout's own print stylesheet, which never touches the packaging canvas, so it survives every
 * failure this module can describe — but only while there is a page on screen to print.
 */
export const pageExportSurvivors = (
	attempts: readonly PageExportAttempt[],
	options: { hasOriginalImage: boolean; hasPage: boolean }
): string => {
	if (pageExportFailures(attempts).length === 0) return '';
	const built = attempts
		.filter((attempt) => attempt.failure === null && attempt.files.length > 0)
		.map((attempt) => SURVIVOR_NOUNS[attempt.variant]);
	const kept = options.hasOriginalImage ? [...built, 'the original image'] : built;
	const haveSentence =
		kept.length > 0 ? `You still have ${asSentenceList(kept)}.` : '';
	const printSentence = options.hasPage ? 'Print still works from this page.' : '';
	return [haveSentence, printSentence].filter((part) => part.length > 0).join(' ');
};

/**
 * The label on the rebuild control, or `null` where no control should be rendered.
 *
 * One control for the whole row rather than one per failed variant, because a rebuild re-runs
 * packaging for the page as a whole and two buttons would imply the reader could choose. It appears
 * as soon as ANY failed variant is retryable: a page whose print PDF can be rebuilt and whose share
 * image provably cannot is still a page worth pressing for, and the sentences beside it already say
 * which is which.
 *
 * Says what it will do and not "Try again", because this row sits under a page-making button and a
 * bare retry there reads as an offer to generate the page again — the exact confusion the wording in
 * `export-failure.ts` exists to prevent.
 */
export const pageExportRetryLabel = (
	attempts: readonly PageExportAttempt[]
): string | null =>
	pageExportFailures(attempts).some((failure) => failure.retry.kind === 'now')
		? 'Build the downloads again'
		: null;
