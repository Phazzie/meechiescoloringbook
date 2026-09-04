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

/** A `src`/`href` for a stored vault image, or '' when the bytes are unreadable. */
export const vaultImageSource = (image: VaultImage): string => {
	if (image.url) return image.url;
	if (!image.b64) return '';
	const kind = detectVaultImageKind(image.b64);
	if (!kind) return '';
	return `data:${kind.mimeType};base64,${compactBase64(image.b64)}`;
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

/** Everything about a saved page a reader might type into the search box. */
export const vaultSearchText = (record: CreationRecord): string =>
	[
		record.intent.title,
		record.studioText?.quote ?? '',
		record.studioText?.verdict ?? '',
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
	nowMs: number
): VaultEntry => {
	const storedImage =
		(record.images ?? []).find((image) => !!image.url || !!image.b64) ?? null;
	const imageSource = storedImage ? vaultImageSource(storedImage) : '';
	const title = record.intent.title;
	return {
		id: record.id,
		title,
		quote: record.studioText?.quote ?? '',
		savedLabel: formatVaultSavedLabel(record.createdAtISO, nowMs),
		imageSource,
		downloadName: `${slugify(title) || 'meechie-coloring-page'}.${vaultImageExtension(imageSource)}`,
		itemCount: record.intent.items.length,
		favorite: record.favorite === true,
		record
	};
};

/** Sort, filter, and label the whole vault in one pass. */
export const buildVaultEntries = (
	records: readonly CreationRecord[],
	options: { query?: string; nowMs?: number } = {}
): VaultEntry[] => {
	const nowMs = options.nowMs ?? Date.now();
	const query = options.query ?? '';
	return sortVaultCreations(records)
		.filter((record) => matchesVaultQuery(record, query))
		.map((record) => buildVaultEntry(record, nowMs));
};
