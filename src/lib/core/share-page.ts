// Purpose: Everything the app needs to decide about handing a finished coloring page to somebody
//          else — whether there is anything to send, which of the packaged files to send and why
//          that one, what the control says, what goes in the share sheet beside the picture, and
//          what each outcome tells the reader afterwards.
// Why: `/random` and `/meechie` both end with "Print it. Color it. Send it to whoever needs to see
//      it." Run 13 made the first two clauses true. The third had never been true anywhere:
//      `grep -rn "navigator.share\|canShare" src/` returned nothing in the whole repository, and
//      `studioActions` in `meechie-studio.ts` — the app's own list of the twelve things a reader can
//      do with a finished page — does not contain sending. The only way to put the page in somebody
//      else's hands was to download a file, leave the app, find it, and attach it by hand, which on
//      the installed app on a phone is the worst version of that walk.
// Info flow: the export row the surface is already showing (+ the page's title and Meechie's line,
//            + what this browser can actually do) -> this module -> the send button's label, its
//            disabled state and reason, the payload handed to the Web Share API, and the sentence
//            shown when it comes back.
//
// Pure. It reads no clock, touches no DOM and calls no browser API: `navigator.share`,
// `navigator.canShare` and `navigator.clipboard.write` all live in `SharePageButton.svelte`, which
// is the one place in the app that talks to the share sheet. This module decides; that component
// calls. Same split as `print-sheet.ts` and `PrintPageButton.svelte`.
import type { PageExport, PageExportKind } from './page-exports';

/** What this browser can do with a finished page, as the component measured it. */
export type ShareCapability =
	/** The Web Share API is present and can be asked about files. */
	| 'files'
	/** No Web Share API, but the clipboard will take an image. */
	| 'clipboard-image'
	/** Neither. The download row is the only way out. */
	| 'none';

/** How a send would actually happen. */
export type ShareMethod = 'web-share' | 'clipboard-image' | 'none';

/** Why a send might not be on offer. */
export type ShareJobStatus =
	/** There is a page and a way to send it. */
	| 'ready'
	/** No finished picture on this surface yet. */
	| 'no-page'
	/** There is a page, and this browser has no way to hand it over. */
	| 'unsupported';

/** What the share sheet is handed: the files, and the words that travel with them. */
export type SharePayload = {
	/**
	 * The exports to send, all of one kind.
	 *
	 * A list rather than one file because a page can be several pictures, and the Web Share API
	 * takes several files. The clipboard path is capped at one — every platform clipboard holds a
	 * single image, so offering to "copy" four and silently keeping the last is a lie.
	 */
	files: PageExport[];
	/** The share sheet's title. Most targets ignore it; the ones that show it show this. */
	title: string;
	/** The message that travels with the picture. This is what a chat actually displays. */
	text: string;
};

/** A send as the reader meets it: one button, one label, one reason it might be off. */
export type ShareJob = {
	status: ShareJobStatus;
	method: ShareMethod;
	canSend: boolean;
	/** What the button says. Names the number when it is more than one, as the print control does. */
	buttonLabel: string;
	/** Why the button is off, or `''` when it is not. */
	blockedReason: string;
	payload: SharePayload;
};

/** What a page with no title of its own is called in somebody else's chat. */
export const FALLBACK_SHARE_TITLE = 'A Meechie coloring page';

/** Named in the share text so the recipient knows what they are looking at. */
export const APP_SHARE_NAME = "Meechie's Coloring Book";

/**
 * The sentence for a screen with no page on it.
 *
 * It says what to do, not what went wrong — nothing has gone wrong. Same shape as
 * `NOTHING_TO_PRINT`, and for the same reason: the disabled button has to explain itself, or it
 * reads as broken.
 */
export const NOTHING_TO_SEND =
	'No coloring page on this screen yet. Make one first — sending hands somebody the picture, not the app.';

/**
 * The sentence for a browser that cannot hand a file over.
 *
 * It points at the downloads rather than apologising, because the downloads are right there and
 * they work. Measured, not assumed: the Web Share API is absent from this project's own test
 * browser (Chromium 1194 on Linux), so this is a state real readers meet, not a theoretical one.
 */
export const SHARE_UNSUPPORTED =
	'This browser cannot hand the picture to another app. Download it from the row above and attach it.';

/** Confirmation after the share sheet reports it took the page. */
export const SHARE_SENT = 'Sent.';

/**
 * The detail for the one send failure this app causes itself.
 *
 * Every other failure comes from the browser and arrives with the browser's own message. This one
 * is a `data:` URL from the export row that could not be read back into bytes, which is this app's
 * fault and is named as such rather than dressed up as the browser's refusal.
 */
export const SHARE_UNREADABLE_DETAIL = 'the picture could not be read back from this page';

/** Confirmation after the clipboard fallback. Says where it went, since nothing visibly happened. */
export const SHARE_COPIED = 'Copied. Paste it straight into any chat.';

/**
 * How a failed send is worded.
 *
 * Opens by affirming the page, exactly as `summarisePageExportFailures` does, and for the same
 * reason: sending runs long after the paid generation succeeded, and a message that reads like the
 * page failed invites the reader to buy another one to fix a free local step.
 */
export const describeShareFailure = (message: string): string => {
	const detail = message.trim();
	return detail.length > 0
		? `Your page is fine — this browser would not send it: ${detail}`
		: 'Your page is fine — this browser would not send it.';
};

/**
 * True when a rejected share was the reader closing the share sheet.
 *
 * The Web Share API rejects with `AbortError` when the reader picks nothing, which is not a
 * failure and must not be reported as one. Treating every rejection as an error is the classic
 * defect in share implementations: you back out of the sheet and the app tells you something
 * broke.
 */
export const isShareCancellation = (errorName: string): boolean =>
	errorName === 'AbortError' || errorName === 'NotAllowedError';

/**
 * Which file to send, in order of preference.
 *
 * `square` first, and the reason is what the packaging adapter actually does: it letterboxes the
 * whole page onto a white 1080px canvas rather than cropping to it, so nothing is cut off, it is a
 * PNG on every platform, and a square image is what previews inline in a chat. `chat` is the same
 * rendering one size down. `original` — the provider's own bytes — comes next: it is the best
 * picture, but its format is whatever the provider sent, and an SVG is refused by most share
 * targets. The print PDF is last: it is the one file here that no messenger previews.
 *
 * Chosen by `kind`, never by sniffing the filename, for the reason `page-exports.ts` gives at
 * length: the caller already knows which variant it asked for, and a filename is a second, weaker
 * answer that starts disagreeing the moment `fileBaseName` changes.
 */
const SHARE_PREFERENCE: readonly PageExportKind[] = ['square', 'chat', 'original', 'print'];

/**
 * The one media type every platform clipboard accepts.
 *
 * `navigator.clipboard.write` is specified around a small set of types, and PNG is the only image
 * type supported across Chromium, WebKit and Gecko. Offering to copy a PDF — or a WEBP — produces a
 * rejected promise and a reader who was told the picture was copied when it was not.
 */
const CLIPBOARD_MIME_TYPE = 'image/png';

/** Long enough for a verdict and a title; short enough that no target truncates mid-word. */
const MAX_SHARE_TEXT_LENGTH = 280;

/** Below this a word-boundary break leaves too little text to be worth the tidiness. */
const MIN_WORD_BREAK_POSITION = MAX_SHARE_TEXT_LENGTH / 2;

/** Collapse whitespace so a multi-line verdict does not arrive as a ragged block. */
const oneLine = (value: string | null | undefined): string =>
	(value ?? '').replace(/\s+/g, ' ').trim();

/**
 * Cut over-long share text at a word boundary.
 *
 * No anchored `X+$` trim afterwards: that is the shape SonarCloud's `super-linear-regex` flags, and
 * it cost this repository two real findings in the print work one run ago. A slice and a
 * `lastIndexOf` do the whole job with no backtracking to reason about.
 */
const capShareText = (value: string): string => {
	if (value.length <= MAX_SHARE_TEXT_LENGTH) return value;
	const sliced = value.slice(0, MAX_SHARE_TEXT_LENGTH);
	const lastSpace = sliced.lastIndexOf(' ');
	const trimmed = lastSpace > MIN_WORD_BREAK_POSITION ? sliced.slice(0, lastSpace) : sliced;
	return `${trimmed}…`;
};

/**
 * The words that travel with the picture.
 *
 * The picture is the point, so this is short: what the page is called, what Meechie said about it
 * if there is a line, and where it came from. The recipient is looking at a coloring page of a
 * verdict about them, and they get to see the verdict as text too — that is the whole "send it to
 * whoever needs to see it" transaction.
 */
export const shareMessageText = (
	pageTitle: string | null | undefined,
	quote: string | null | undefined
): string => {
	const title = oneLine(pageTitle) || FALLBACK_SHARE_TITLE;
	const line = oneLine(quote);
	// Dropped when the title already carries it. On the mode routes and the tools hub the page title
	// is compacted *from* the verdict, so passing the verdict as the line too would send
	// `Receipt Energy — “Receipt Energy”`. The surfaces differ in whether those are two facts or
	// one, and the answer belongs here rather than in each of thirteen call sites.
	const carriesLine = line.length > 0 && !title.toLowerCase().includes(line.toLowerCase());
	const opening = carriesLine ? `${title} — “${line}”` : title;
	return capShareText(`${opening}\nMade in ${APP_SHARE_NAME}.`);
};

/**
 * The exports that would actually be sent, in preference order, filtered to what the method can
 * carry.
 *
 * Returns every export of the winning kind, so a page that is several pictures sends as several
 * files rather than quietly sending the first.
 */
export const chooseShareExports = (
	exports: readonly PageExport[],
	method: ShareMethod
): PageExport[] => {
	if (method === 'none') return [];
	const eligible =
		method === 'clipboard-image'
			? exports.filter((item) => item.mimeType.toLowerCase() === CLIPBOARD_MIME_TYPE)
			: [...exports];
	for (const kind of SHARE_PREFERENCE) {
		const matching = eligible.filter((item) => item.kind === kind);
		// One image is all a clipboard holds; see `SharePayload.files`.
		if (matching.length > 0) return method === 'clipboard-image' ? [matching[0]] : matching;
	}
	return [];
};

/**
 * The method a capability offers, before knowing whether there is anything it can carry.
 *
 * A lookup rather than a chain of ternaries: it is total over `ShareCapability` by construction, so
 * a fourth capability is a type error here rather than a silent fall-through to `'none'`.
 */
const METHOD_FOR_CAPABILITY: Record<ShareCapability, ShareMethod> = {
	files: 'web-share',
	'clipboard-image': 'clipboard-image',
	none: 'none'
};

const buttonLabelFor = (method: ShareMethod, fileCount: number): string => {
	if (method === 'clipboard-image') return 'Copy the picture';
	if (fileCount > 1) return `Send ${fileCount} pages`;
	return 'Send this page';
};

/**
 * Describe the send for a surface showing `exports`.
 *
 * The export row is the input rather than the raw packaged files, because the row already carries
 * the one fact the choice turns on — which variant each file is — and deriving that twice is how
 * two surfaces come to disagree about the same page.
 *
 * `capability` is passed in rather than detected here so this module stays pure and so the answer
 * is the *browser's*, measured at the moment of the click, rather than a guess baked into a
 * prerendered document. Every page route in this app is prerendered and the service worker replays
 * those documents offline; a capability decided at build time would be the build machine's.
 */
export const describeShareJob = (input: {
	exports: readonly PageExport[];
	pageTitle?: string | null;
	quote?: string | null;
	capability: ShareCapability;
}): ShareJob => {
	const title = oneLine(input.pageTitle) || FALLBACK_SHARE_TITLE;
	const text = shareMessageText(input.pageTitle, input.quote);
	const method = METHOD_FOR_CAPABILITY[input.capability];
	const files = chooseShareExports(input.exports, method);
	const payload: SharePayload = { files, title, text };

	// Asked first, and of the row rather than of the browser: with no page on the screen the
	// reason is the same on every device, which is what keeps the prerendered document — where no
	// page can exist yet — saying the same thing as the hydrated one.
	if (input.exports.length === 0) {
		return {
			status: 'no-page',
			method,
			canSend: false,
			buttonLabel: 'Send',
			blockedReason: NOTHING_TO_SEND,
			payload: { ...payload, files: [] }
		};
	}

	if (files.length === 0) {
		return {
			status: 'unsupported',
			method: 'none',
			canSend: false,
			buttonLabel: 'Send',
			blockedReason: SHARE_UNSUPPORTED,
			payload: { ...payload, files: [] }
		};
	}

	return {
		status: 'ready',
		method,
		canSend: true,
		buttonLabel: buttonLabelFor(method, files.length),
		blockedReason: '',
		payload
	};
};

/** The bytes behind a `data:` URL, and the media type it declares. */
export type DecodedDataUrl = {
	bytes: Uint8Array;
	mimeType: string;
};

/**
 * Turn one of the export row's `data:` URLs back into bytes.
 *
 * Needed because the Web Share API and the clipboard both take `File`/`Blob`, and the export row
 * holds `data:` URLs — the same strings the download links already point at, so what gets sent is
 * byte-for-byte what a download would have handed over.
 *
 * Both encodings the row produces are handled: packaged files arrive as `;base64,`, and an SVG
 * original arrives as `;utf8,` percent-encoded — see `generatedImageDataUrl`. A URL in neither
 * shape returns `null` rather than a guess, because a malformed file offered to a share sheet
 * fails in the target app, where this app cannot explain it.
 */
export const decodeDataUrl = (href: string): DecodedDataUrl | null => {
	if (!href.startsWith('data:')) return null;
	const commaAt = href.indexOf(',');
	if (commaAt === -1) return null;
	const header = href.slice('data:'.length, commaAt);
	const payload = href.slice(commaAt + 1);
	const parameters = header.split(';');
	const mimeType = parameters[0] || 'application/octet-stream';
	const isBase64 = parameters.includes('base64');
	try {
		if (isBase64) {
			const binary = atob(payload);
			const bytes = new Uint8Array(binary.length);
			for (let index = 0; index < binary.length; index += 1) {
				bytes[index] = binary.charCodeAt(index);
			}
			return { bytes, mimeType };
		}
		return { bytes: new TextEncoder().encode(decodeURIComponent(payload)), mimeType };
	} catch {
		// `atob` throws on invalid base64 and `decodeURIComponent` on a malformed escape. Either way
		// there are no bytes to send, and that is the same answer as a URL this cannot read.
		return null;
	}
};
