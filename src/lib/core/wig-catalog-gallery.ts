// Purpose: Pure search, facet, and sort transforms over the wig catalog.
// Why: Every wig carries a brand, hair type, length, colour family and tags, and the carousel
//      showed none of it and let you filter on none of it — a shop schema with no shopping. The
//      transforms live here, dependency-free, so the rules are testable without a browser.
// Info flow: Wig[] from WigCatalogSeam -> buildWigFacets/applyWigQuery -> WigCarousel rendering.
import type {
	ColorFamily,
	HairType,
	Wig,
	WigLength
} from '$lib/seams/wig-catalog-seam/contract';

export type WigSortId = 'featured' | 'price_low' | 'price_high' | 'name';

export const WIG_SORT_OPTIONS: readonly { id: WigSortId; label: string }[] = [
	{ id: 'featured', label: 'Featured' },
	{ id: 'price_low', label: 'Price: Low to High' },
	{ id: 'price_high', label: 'Price: High to Low' },
	{ id: 'name', label: 'Name A–Z' }
];

/**
 * A shopper picks values within one dimension as "any of these" and across dimensions as "all of
 * these": long OR extra-long, AND human hair. An empty list means the dimension is not filtering.
 */
export type WigQuery = {
	search: string;
	lengths: readonly WigLength[];
	hairTypes: readonly HairType[];
	colorFamilies: readonly ColorFamily[];
	sort: WigSortId;
};

export const DEFAULT_WIG_QUERY: WigQuery = {
	search: '',
	lengths: [],
	hairTypes: [],
	colorFamilies: [],
	sort: 'featured'
};

// Canonical display order, so a chip never moves because the catalog was reordered. Only values
// the catalog actually contains are ever rendered — a chip for a length no wig has is a dead end.
const LENGTH_ORDER: readonly WigLength[] = ['short', 'medium', 'long', 'extra-long'];
const HAIR_TYPE_ORDER: readonly HairType[] = ['human', 'synthetic', 'blend'];
const COLOR_FAMILY_ORDER: readonly ColorFamily[] = [
	'black',
	'brown',
	'blonde',
	'red',
	'gray',
	'vibrant',
	'ombre'
];

export const WIG_LENGTH_LABELS: Readonly<Record<WigLength, string>> = {
	short: 'Short',
	medium: 'Medium',
	long: 'Long',
	'extra-long': 'Extra long'
};

export const WIG_HAIR_TYPE_LABELS: Readonly<Record<HairType, string>> = {
	human: 'Human hair',
	synthetic: 'Synthetic',
	blend: 'Blend'
};

export const WIG_COLOR_FAMILY_LABELS: Readonly<Record<ColorFamily, string>> = {
	black: 'Black',
	brown: 'Brown',
	blonde: 'Blonde',
	red: 'Red',
	gray: 'Gray',
	vibrant: 'Vibrant',
	ombre: 'Ombre'
};

/**
 * Everything a shopper might type: the wig's name and brand, how it is described, its colour by
 * name and by family, what it is made of, how long it is, and its tags. Lowercased once per call.
 */
const searchableText = (wig: Wig): string =>
	[
		wig.name,
		wig.brand,
		wig.style,
		wig.color,
		wig.colorFamily,
		wig.hairType,
		wig.length,
		...wig.tags
	]
		.join(' ')
		.toLowerCase();

/**
 * Terms are ANDed: "long human" means both, which is what a shopper narrowing a list expects. A
 * term matches as a substring, so "long" also finds "extra-long" and "bob" finds "Blunt Bob".
 */
export const wigSearchTerms = (search: string): string[] =>
	search.toLowerCase().split(/\s+/).filter((term) => term.length > 0);

const matchesSearch = (wig: Wig, terms: readonly string[]): boolean => {
	if (terms.length === 0) return true;
	const haystack = searchableText(wig);
	return terms.every((term) => haystack.includes(term));
};

const matchesDimension = <T>(selected: readonly T[], value: T): boolean =>
	selected.length === 0 || selected.includes(value);

/**
 * Case-insensitive, locale-independent ordering. `localeCompare` would sort differently depending
 * on where the page is opened, and the price and name shown for one wig already had to be pinned
 * to a single locale once in this feature for exactly that reason.
 */
const byNameAscending = (left: Wig, right: Wig): number => {
	const a = left.name.toLowerCase();
	const b = right.name.toLowerCase();
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
};

const sortWigs = (wigs: readonly Wig[], sort: WigSortId): Wig[] => {
	const sorted = [...wigs];
	switch (sort) {
		case 'price_low':
			// Price ties fall back to name so the order is total, not merely stable-by-accident:
			// two $89.99 wigs must not swap places when an unrelated filter changes.
			return sorted.sort((a, b) => a.priceUsd - b.priceUsd || byNameAscending(a, b));
		case 'price_high':
			return sorted.sort((a, b) => b.priceUsd - a.priceUsd || byNameAscending(a, b));
		case 'name':
			return sorted.sort(byNameAscending);
		case 'featured':
		default:
			// Catalog order is the curated order. Returned as a copy so callers never mutate input.
			return sorted;
	}
};

/**
 * Applies the search and every dimension, then orders the survivors. Never mutates `wigs`.
 */
export const applyWigQuery = (wigs: readonly Wig[], query: WigQuery): Wig[] => {
	const terms = wigSearchTerms(query.search);
	const matched = wigs.filter(
		(wig) =>
			matchesSearch(wig, terms) &&
			matchesDimension(query.lengths, wig.length) &&
			matchesDimension(query.hairTypes, wig.hairType) &&
			matchesDimension(query.colorFamilies, wig.colorFamily)
	);
	return sortWigs(matched, query.sort);
};

export type WigFacetValue<T extends string> = {
	value: T;
	label: string;
	/** How many wigs this value would contribute, given the search and every *other* dimension. */
	count: number;
	selected: boolean;
};

export type WigFacets = {
	lengths: WigFacetValue<WigLength>[];
	hairTypes: WigFacetValue<HairType>[];
	colorFamilies: WigFacetValue<ColorFamily>[];
};

/**
 * Builds one dimension's chips.
 *
 * The count is deliberately *not* "how many wigs in the catalog have this value". That number is
 * easier and it lies: with Human hair already selected, a "Blonde (1)" chip whose only blonde wig
 * is synthetic yields nothing when tapped. Each count here is measured against the search and every
 * other dimension, so it is exactly what tapping the chip would contribute — and a zero count means
 * the chip is a dead end, which the carousel disables rather than offering.
 *
 * A value that is currently selected is still counted and still shown, so it can always be undone.
 */
const buildFacet = <T extends string>(
	wigs: readonly Wig[],
	order: readonly T[],
	labels: Readonly<Record<T, string>>,
	valueOf: (_wig: Wig) => T,
	selected: readonly T[],
	matchesOtherDimensions: (_wig: Wig) => boolean
): WigFacetValue<T>[] => {
	const present = new Set(wigs.map(valueOf));
	return order
		.filter((value) => present.has(value))
		.map((value) => ({
			value,
			label: labels[value],
			count: wigs.filter((wig) => matchesOtherDimensions(wig) && valueOf(wig) === value).length,
			selected: selected.includes(value)
		}));
};

export const buildWigFacets = (wigs: readonly Wig[], query: WigQuery): WigFacets => {
	const terms = wigSearchTerms(query.search);
	const matchesSearchOnly = (wig: Wig): boolean => matchesSearch(wig, terms);

	return {
		lengths: buildFacet(
			wigs,
			LENGTH_ORDER,
			WIG_LENGTH_LABELS,
			(wig) => wig.length,
			query.lengths,
			(wig) =>
				matchesSearchOnly(wig) &&
				matchesDimension(query.hairTypes, wig.hairType) &&
				matchesDimension(query.colorFamilies, wig.colorFamily)
		),
		hairTypes: buildFacet(
			wigs,
			HAIR_TYPE_ORDER,
			WIG_HAIR_TYPE_LABELS,
			(wig) => wig.hairType,
			query.hairTypes,
			(wig) =>
				matchesSearchOnly(wig) &&
				matchesDimension(query.lengths, wig.length) &&
				matchesDimension(query.colorFamilies, wig.colorFamily)
		),
		colorFamilies: buildFacet(
			wigs,
			COLOR_FAMILY_ORDER,
			WIG_COLOR_FAMILY_LABELS,
			(wig) => wig.colorFamily,
			query.colorFamilies,
			(wig) =>
				matchesSearchOnly(wig) &&
				matchesDimension(query.lengths, wig.length) &&
				matchesDimension(query.hairTypes, wig.hairType)
		)
	};
};

/** Adds a value to a dimension, or removes it if it is already there. Never mutates `selected`. */
export const toggleWigFacetValue = <T extends string>(
	selected: readonly T[],
	value: T
): T[] =>
	selected.includes(value)
		? selected.filter((entry) => entry !== value)
		: [...selected, value];

/** Whether anything is narrowing or reordering the list, and so whether "Clear" has work to do. */
export const isWigQueryActive = (query: WigQuery): boolean =>
	query.search.trim().length > 0 ||
	query.lengths.length > 0 ||
	query.hairTypes.length > 0 ||
	query.colorFamilies.length > 0 ||
	query.sort !== DEFAULT_WIG_QUERY.sort;

/** The metadata line the card was hiding: how long, what it is made of, and its colour by name. */
export const wigDetailLine = (wig: Wig): string =>
	[WIG_LENGTH_LABELS[wig.length], WIG_HAIR_TYPE_LABELS[wig.hairType], wig.color].join(' · ');

/** "8 wigs" when nothing is filtered, "3 of 8 wigs" when something is. */
export const describeWigMatches = (shown: number, total: number): string => {
	const noun = total === 1 ? 'wig' : 'wigs';
	return shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`;
};
