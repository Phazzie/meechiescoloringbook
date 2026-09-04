// Purpose: Pure helpers that turn stored CreationRecords into a browsable, restorable Quote Vault.
// Why: The vault stored every saved page's image bytes and then showed none of them — no
//      thumbnail, no date, no search, four rows maximum, and reopening a page threw the picture
//      away. Sorting, filtering, labelling, and rebuilding a GeneratedImage from a stored record
//      are all deterministic transforms, so they live here as pure functions the UI and the tests
//      can both drive without touching localStorage.
// Info flow: CreationRecord[] -> sort/filter/label -> VaultEntry[] for the UI; a single record's
//            stored base64 -> byte-signature sniff -> GeneratedImage[] the studio can re-render
//            and re-package.
import type { CreationRecord } from '../../../contracts/creation-store.contract';
import type { GeneratedImage } from '../../../contracts/image-generation.contract';
import {
	detectRasterMimeTypeFromBytes,
	type RasterMimeType
} from './raster-image-format';

/** One stored image inside a CreationRecord: exactly one of `b64` or `url` is guaranteed. */
export type VaultImage = NonNullable<CreationRecord['images']>[number];

/** How many saved pages the vault shows before the reader asks for the rest. */
export const VAULT_PREVIEW_COUNT = 4;

/**
 * How many saved pages the store keeps before it drops the oldest. This mirrors `MAX_CREATIONS`
 * in `src/lib/adapters/creation-store.adapter.ts`, which is module-private; exporting it would be
 * an adapter change and so would need the full Seam-Driven Development workflow. The mirror is
 * not taken on trust — `tests/unit/vault-gallery.test.ts` drives the real adapter past this
 * number and fails if the store's actual cap ever stops matching.
 */
export const VAULT_CAPACITY = 50;

// 24 base64 characters decode to exactly 18 bytes — more than every signature checked below
// (WebP needs 12) and small enough that sniffing a megabyte-sized page costs nothing.
const BASE64_SNIFF_CHARS = 24;

const RASTER_FORMATS: Record<RasterMimeType, GeneratedImage['format']> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp'
};

const FILE_EXTENSIONS: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/svg+xml': 'svg'
};

const MONTH_NAMES = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
] as const;

const DAY_MS = 86_400_000;

const compactBase64 = (base64: string): string => base64.replace(/\s+/g, '');

const decodeBase64ToBytes = (base64: string): Uint8Array | null => {
	if (typeof atob !== 'function') return null;
	try {
		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) {
			bytes[index] = binary.charCodeAt(index);
		}
		return bytes;
	} catch {
		return null;
	}
};

// Whether the whole blob is well-formed base64, not merely a recognisable prefix. Checked by
// syntax rather than by decoding, so a megabyte-sized page costs a regex rather than a megabyte of
// allocation on every render: the alphabet, the 4-character grouping, and padding only at the end
// are exactly what a decoder rejects.
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

const isDecodableBase64 = (compact: string): boolean =>
	compact.length > 0 && compact.length % 4 === 0 && BASE64_PATTERN.test(compact);

// An SVG saved to the vault was base64-encoded on the way in, so the raster signature check
// cannot see it. Decoding the same 18-byte prefix as text catches both shapes a generated SVG
// arrives in: a bare `<svg` root, or an XML declaration ahead of it.
const looksLikeSvg = (bytes: Uint8Array): boolean => {
	let text = '';
	for (const byte of bytes) {
		text += String.fromCharCode(byte);
	}
	const head = text.replace(/^[\uFEFF\s]+/, '').toLowerCase();
	return head.startsWith('<svg') || head.startsWith('<?xml');
};

export type VaultImageKind =
	| { kind: 'raster'; mimeType: RasterMimeType; format: GeneratedImage['format'] }
	| { kind: 'svg'; mimeType: 'image/svg+xml' };

/**
 * Identify what a stored base64 blob actually is from its bytes. The vault record keeps only
 * `b64` — `saveToVault` drops the format and encoding the generator reported — so the bytes are
 * the only remaining evidence of what was saved.
 */
export const detectVaultImageKind = (base64: string): VaultImageKind | null => {
	const compact = compactBase64(base64);
	const sniffLength = Math.min(BASE64_SNIFF_CHARS, compact.length);
	const prefix = compact.slice(0, sniffLength - (sniffLength % 4));
	if (prefix.length === 0) return null;
	const bytes = decodeBase64ToBytes(prefix);
	if (!bytes || bytes.length === 0) return null;
	const raster = detectRasterMimeTypeFromBytes(bytes);
	if (raster) {
		return { kind: 'raster', mimeType: raster, format: RASTER_FORMATS[raster] };
	}
	if (looksLikeSvg(bytes)) {
		return { kind: 'svg', mimeType: 'image/svg+xml' };
	}
	return null;
};

// A stored `url` is whatever was in browser storage when the vault was read, and it feeds an
// `<a href>` as well as an `<img src>`. `svelte.config.js` sets `img-src 'self' data: blob:`, so
// only a same-origin URL can ever render; an off-origin one is blocked by the app's own CSP and
// could only show as a broken thumbnail with a dead download beside it, and a `javascript:` value
// must never become a link the reader can click.
//
// Same-origin covers two shapes. A root-relative path is same-origin by construction. An absolute
// URL is same-origin only when its origin matches the running app's, which the caller supplies —
// `CreationImageSchema` accepts any non-empty string, so records written before the vault existed
// may well carry a fully qualified URL on the app's own host, and rejecting those outright would
// blank a thumbnail the CSP would happily have loaded.
const isSafeStoredUrl = (url: string, appOrigin: string): boolean => {
	// `//host/path` is protocol-relative: it looks path-like but resolves off-origin.
	if (url.startsWith('/')) return !url.startsWith('//');
	if (appOrigin.length === 0) return false;
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
		return parsed.origin === appOrigin;
	} catch {
		return false;
	}
};

/**
 * A `src`/`href` for a stored vault image, or '' when it is unreadable or unsafe to link to.
 *
 * `appOrigin` is the origin the app is served from (`location.origin` in the browser, '' when
 * there is none, as in a server render or a unit test). It is passed in rather than read here so
 * this stays a pure function of its inputs.
 */
export const vaultImageSource = (image: VaultImage, appOrigin = ''): string => {
	// Stored bytes win over a stored url. A contract-valid record may carry both, and the bytes
	// always render under the CSP above while an off-origin url never does.
	//
	// Preferring the bytes requires more than a matching signature. `detectVaultImageKind` sniffs
	// only the first 18 bytes, so a truncated or corrupted blob can open with a perfectly good PNG
	// header and still be undecodable — and returning a data url built from it would hand the
	// reader a broken thumbnail and a dead download while a working url sat unused in the same
	// record. The whole payload is checked for base64 validity before it wins.
	if (image.b64) {
		const compact = compactBase64(image.b64);
		const kind = detectVaultImageKind(compact);
		if (kind && isDecodableBase64(compact)) return `data:${kind.mimeType};base64,${compact}`;
	}
	if (image.url && isSafeStoredUrl(image.url, appOrigin)) return image.url;
	return '';
};

/** The download extension that matches what `vaultImageSource` produced. */
export const vaultImageExtension = (source: string): string => {
	const match = source.match(/^data:([^;,]+)[;,]/);
	if (match) return FILE_EXTENSIONS[match[1]] ?? 'png';
	const pathMatch = source.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i);
	if (pathMatch) {
		const extension = pathMatch[1].toLowerCase();
		if (Object.values(FILE_EXTENSIONS).includes(extension)) return extension;
		if (extension === 'jpeg') return 'jpg';
	}
	return 'png';
};

/**
 * Rebuild the studio's in-memory images from a saved record so reopening a page shows the page
 * again instead of an empty sheet. SVG comes back as utf8 text — the shape the packaging adapter
 * and the preview both expect — while raster formats stay base64.
 */
export const restoreCreationImages = (record: CreationRecord): GeneratedImage[] => {
	const restored: GeneratedImage[] = [];
	for (const [index, image] of (record.images ?? []).entries()) {
		// A url-only record carries no bytes, so there is nothing to restore into the studio.
		if (!image.b64) continue;
		const compact = compactBase64(image.b64);
		const kind = detectVaultImageKind(compact);
		if (!kind) continue;
		const id = `${record.id}-saved-${index + 1}`;
		if (kind.kind === 'svg') {
			const bytes = decodeBase64ToBytes(compact);
			if (!bytes || bytes.length === 0) continue;
			const markup = new TextDecoder().decode(bytes);
			if (markup.length === 0) continue;
			restored.push({
				id,
				format: 'svg',
				mimeType: kind.mimeType,
				data: markup,
				encoding: 'utf8'
			});
			continue;
		}
		restored.push({
			id,
			format: kind.format,
			mimeType: kind.mimeType,
			data: compact,
			encoding: 'base64'
		});
	}
	return restored;
};

const savedAtMs = (record: CreationRecord): number => {
	const parsed = Date.parse(record.createdAtISO);
	return Number.isNaN(parsed) ? 0 : parsed;
};

/** Pinned pages first, then newest first. Ties break on id so the order never flickers. */
export const sortVaultCreations = (
	records: readonly CreationRecord[]
): CreationRecord[] =>
	[...records].sort((left, right) => {
		const leftPinned = left.favorite === true;
		const rightPinned = right.favorite === true;
		if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
		const byDate = savedAtMs(right) - savedAtMs(left);
		if (byDate !== 0) return byDate;
		return left.id.localeCompare(right.id);
	});

/**
 * The quote a row shows, or '' when the record never stored one.
 *
 * Records saved before `studioText` existed carry no quote, and there is nothing faithful to
 * reconstruct it from. `buildStudioTextFromCreationRecord` falls back to `assembledPrompt`, but on
 * a generated page that field holds the full image-generation prompt returned by `/api/generate`
 * — multiline rendering instructions, not anything Meechie said. Rendering that inside quotation
 * marks, and folding its boilerplate into the search text, is worse than showing no quote, so the
 * row simply omits one; `VerdictRow.svelte` already renders the quote line only when it is set.
 */
export const vaultQuote = (record: CreationRecord): string =>
	record.studioText?.quote ?? '';

const vaultVerdict = (record: CreationRecord): string => record.studioText?.verdict ?? '';

/** Everything about a saved page a reader might type into the search box. */
export const vaultSearchText = (record: CreationRecord): string =>
	[
		record.intent.title,
		vaultQuote(record),
		vaultVerdict(record),
		record.intent.dedication ?? '',
		record.intent.footerItem?.label ?? '',
		...record.intent.items.map((item) => item.label)
	]
		.join(' ')
		.toLowerCase();

/** Every whitespace-separated term must appear somewhere in the record. Empty query matches all. */
export const matchesVaultQuery = (
	record: CreationRecord,
	query: string
): boolean => {
	const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) return true;
	const haystack = vaultSearchText(record);
	return terms.every((term) => haystack.includes(term));
};

/**
 * "Saved today" / "Saved 3 days ago" / "Saved Sep 3, 2026". Calendar days are counted in UTC so
 * the label is a pure function of the stored instant and never depends on the runner's timezone.
 */
export const formatVaultSavedLabel = (
	createdAtISO: string,
	nowMs: number
): string => {
	const saved = Date.parse(createdAtISO);
	if (Number.isNaN(saved)) return 'Saved date unknown';
	const daysAgo = Math.floor(nowMs / DAY_MS) - Math.floor(saved / DAY_MS);
	// A record stamped slightly ahead of the clock reads as today rather than "-1 days ago".
	if (daysAgo <= 0) return 'Saved today';
	if (daysAgo === 1) return 'Saved yesterday';
	if (daysAgo < 7) return `Saved ${daysAgo} days ago`;
	const date = new Date(saved);
	return `Saved ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
};

const slugify = (title: string): string =>
	title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);

/** One saved page, ready to render: everything the card shows plus the record behind it. */
export type VaultEntry = {
	id: string;
	title: string;
	quote: string;
	savedLabel: string;
	imageSource: string;
	downloadName: string;
	itemCount: number;
	favorite: boolean;
	record: CreationRecord;
};

export const buildVaultEntry = (
	record: CreationRecord,
	nowMs: number,
	appOrigin = ''
): VaultEntry => {
	// The first image that actually resolves, not merely the first non-empty one: a record whose
	// leading entry has unreadable bytes or an unusable url would otherwise show a placeholder and
	// no download even though a later entry is perfectly renderable.
	const imageSource =
		(record.images ?? [])
			.map((image) => vaultImageSource(image, appOrigin))
			.find((source) => source.length > 0) ?? '';
	const title = record.intent.title;
	return {
		id: record.id,
		title,
		quote: vaultQuote(record),
		savedLabel: formatVaultSavedLabel(record.createdAtISO, nowMs),
		imageSource,
		downloadName: `${slugify(title) || 'meechie-coloring-page'}.${vaultImageExtension(imageSource)}`,
		itemCount: record.intent.items.length,
		favorite: record.favorite === true,
		record
	};
};

/**
 * Sort, filter, and label the whole vault in one pass.
 *
 * `nowMs` is required, not defaulted: `AGENTS.md` classifies clock access as a seam, and reading
 * the clock here would put an unseamed `Date.now()` inside core logic that is otherwise pure. The
 * caller supplies the instant, which also makes every label a pure function of its inputs.
 * `appOrigin` is supplied for the same reason — see `vaultImageSource`.
 */
export const buildVaultEntries = (
	records: readonly CreationRecord[],
	options: { query?: string; nowMs: number; appOrigin?: string }
): VaultEntry[] => {
	const nowMs = options.nowMs;
	const query = options.query ?? '';
	const appOrigin = options.appOrigin ?? '';
	return sortVaultCreations(records)
		.filter((record) => matchesVaultQuery(record, query))
		.map((record) => buildVaultEntry(record, nowMs, appOrigin));
};
