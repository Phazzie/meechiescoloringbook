// Purpose: Unit tests for the pure wig catalog search, facet, and sort transforms.
// Why: The carousel's filters are only trustworthy if the counts on them are, and a facet count
//      that ignores the other facets is the exact kind of control-that-lies this module replaced.
// Info flow: fixture Wig[] -> applyWigQuery/buildWigFacets -> assertions.
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_WIG_QUERY,
	WIG_SORT_OPTIONS,
	applyWigQuery,
	buildWigFacets,
	describeWigMatches,
	isWigQueryActive,
	toggleWigFacetValue,
	wigDetailLine,
	wigSearchTerms,
	type WigQuery
} from '../../src/lib/core/wig-catalog-gallery';
import type { Wig } from '../../src/lib/seams/wig-catalog-seam/contract';

const wig = (overrides: Partial<Wig> & Pick<Wig, 'id' | 'name'>): Wig => ({
	brand: 'Testbrand',
	affiliateProgram: 'beautyforever',
	affiliateUrl: `https://example.com/${overrides.id}`,
	imageUrl: `/wigs/${overrides.id}.jpg`,
	priceUsd: 99.99,
	style: 'straight',
	hairType: 'human',
	length: 'long',
	color: 'Natural Black',
	colorFamily: 'black',
	tags: [],
	...overrides
});

// Deliberately shaped so that one dimension can exclude another: the only blonde wig is synthetic,
// so "Human hair + Blonde" is empty — which is what the cross-filtered counts have to report.
const CATALOG: Wig[] = [
	wig({
		id: 'w1',
		name: 'Sleek Straight Goddess',
		brand: 'Beautyforever',
		priceUsd: 129.99,
		style: 'straight lace front',
		hairType: 'human',
		length: 'long',
		color: 'Natural Black',
		colorFamily: 'black',
		tags: ['sleek', 'professional', 'everyday']
	}),
	wig({
		id: 'w2',
		name: 'Honey Drip Bombshell',
		brand: 'Wigsbuy',
		priceUsd: 89.99,
		style: 'body wave',
		hairType: 'synthetic',
		length: 'long',
		color: 'Honey Blonde',
		colorFamily: 'blonde',
		tags: ['bold', 'statement', 'fierce']
	}),
	wig({
		id: 'w3',
		name: 'Blunt Bob Boss',
		brand: 'Luvmehair',
		priceUsd: 59.99,
		style: 'blunt bob',
		hairType: 'human',
		length: 'short',
		color: 'Natural Black',
		colorFamily: 'black',
		tags: ['bob', 'chic', 'editorial']
	}),
	wig({
		id: 'w4',
		name: 'Copper Fade Queen',
		brand: 'Beautyforever',
		priceUsd: 89.99,
		style: 'ombre curls',
		hairType: 'human',
		length: 'extra-long',
		color: 'Black to Copper Ombre',
		colorFamily: 'ombre',
		tags: ['dramatic', 'curly']
	})
];

const queryWith = (overrides: Partial<WigQuery>): WigQuery => ({
	...DEFAULT_WIG_QUERY,
	...overrides
});

const idsFor = (overrides: Partial<WigQuery>): string[] =>
	applyWigQuery(CATALOG, queryWith(overrides)).map((entry) => entry.id);

describe('wigSearchTerms', () => {
	it('splits on whitespace, lowercases, and drops empties', () => {
		expect(wigSearchTerms('  Honey   BLONDE ')).toEqual(['honey', 'blonde']);
	});

	it('returns no terms for an empty or whitespace-only search', () => {
		expect(wigSearchTerms('')).toEqual([]);
		expect(wigSearchTerms('   ')).toEqual([]);
	});
});

describe('applyWigQuery search', () => {
	it('matches on the wig name', () => {
		expect(idsFor({ search: 'bombshell' })).toEqual(['w2']);
	});

	it('matches on brand, style, colour name and tags', () => {
		expect(idsFor({ search: 'luvmehair' })).toEqual(['w3']);
		expect(idsFor({ search: 'body wave' })).toEqual(['w2']);
		expect(idsFor({ search: 'copper' })).toEqual(['w4']);
		expect(idsFor({ search: 'editorial' })).toEqual(['w3']);
	});

	it('is case insensitive', () => {
		expect(idsFor({ search: 'BLUNT BOB' })).toEqual(['w3']);
	});

	it('ANDs the terms, so a second word narrows rather than widens', () => {
		expect(idsFor({ search: 'black' })).toEqual(['w1', 'w3', 'w4']);
		expect(idsFor({ search: 'black bob' })).toEqual(['w3']);
	});

	it('matches a term as a substring, so "long" also finds extra-long', () => {
		expect(idsFor({ search: 'long' })).toEqual(['w1', 'w2', 'w4']);
	});

	it('returns nothing when no wig matches every term', () => {
		expect(idsFor({ search: 'blonde bob' })).toEqual([]);
	});
});

describe('applyWigQuery dimensions', () => {
	it('ORs values within one dimension', () => {
		expect(idsFor({ lengths: ['short', 'extra-long'] })).toEqual(['w3', 'w4']);
	});

	it('ANDs across dimensions', () => {
		expect(idsFor({ lengths: ['long'], hairTypes: ['human'] })).toEqual(['w1']);
	});

	it('treats an empty dimension as "not filtering"', () => {
		expect(idsFor({})).toEqual(['w1', 'w2', 'w3', 'w4']);
	});

	it('combines the search with the dimensions', () => {
		expect(idsFor({ search: 'black', lengths: ['short'] })).toEqual(['w3']);
	});
});

describe('applyWigQuery sorting', () => {
	it('keeps catalog order for featured', () => {
		expect(idsFor({ sort: 'featured' })).toEqual(['w1', 'w2', 'w3', 'w4']);
	});

	it('sorts by price ascending and descending', () => {
		expect(idsFor({ sort: 'price_low' })).toEqual(['w3', 'w4', 'w2', 'w1']);
		expect(idsFor({ sort: 'price_high' })).toEqual(['w1', 'w4', 'w2', 'w3']);
	});

	it('breaks a price tie by name, in both directions, so the order is total', () => {
		// w2 (Honey Drip, $89.99) and w4 (Copper Fade, $89.99) tie. "Copper" sorts before "Honey"
		// either way round, so the tie must not simply reverse with the price direction.
		expect(idsFor({ sort: 'price_low' }).slice(1, 3)).toEqual(['w4', 'w2']);
		expect(idsFor({ sort: 'price_high' }).slice(1, 3)).toEqual(['w4', 'w2']);
	});

	it('sorts by name case-insensitively', () => {
		expect(idsFor({ sort: 'name' })).toEqual(['w3', 'w4', 'w2', 'w1']);
	});

	it('offers exactly the sorts it implements', () => {
		expect(WIG_SORT_OPTIONS.map((option) => option.id)).toEqual([
			'featured',
			'price_low',
			'price_high',
			'name'
		]);
	});

	it('never mutates or reorders the catalog it was given', () => {
		const original = [...CATALOG];
		applyWigQuery(CATALOG, queryWith({ sort: 'price_high' }));
		expect(CATALOG).toEqual(original);
	});
});

describe('buildWigFacets', () => {
	it('offers only values the catalog actually contains', () => {
		const facets = buildWigFacets(CATALOG, DEFAULT_WIG_QUERY);
		// No 'medium' wig and no 'blend' wig in this catalog, so neither gets a chip.
		expect(facets.lengths.map((facet) => facet.value)).toEqual(['short', 'long', 'extra-long']);
		expect(facets.hairTypes.map((facet) => facet.value)).toEqual(['human', 'synthetic']);
		expect(facets.colorFamilies.map((facet) => facet.value)).toEqual([
			'black',
			'blonde',
			'ombre'
		]);
	});

	it('counts against the whole catalog when nothing else is filtering', () => {
		const facets = buildWigFacets(CATALOG, DEFAULT_WIG_QUERY);
		expect(facets.hairTypes).toEqual([
			{ value: 'human', label: 'Human hair', count: 3, selected: false },
			{ value: 'synthetic', label: 'Synthetic', count: 1, selected: false }
		]);
	});

	/**
	 * The load-bearing one. Counting each value against the whole catalog is easier and lies: the
	 * only blonde wig here is synthetic, so with Human hair selected a "Blonde (1)" chip would
	 * promise a result it cannot deliver.
	 */
	it('counts a value against the search and every OTHER dimension', () => {
		const facets = buildWigFacets(CATALOG, queryWith({ hairTypes: ['human'] }));
		const blonde = facets.colorFamilies.find((facet) => facet.value === 'blonde');

		expect(blonde?.count).toBe(0);
		// And the count is honest: selecting it really does return nothing.
		expect(idsFor({ hairTypes: ['human'], colorFamilies: ['blonde'] })).toEqual([]);
	});

	it('never lets a chip with a non-zero count come back empty', () => {
		const query = queryWith({ hairTypes: ['human'] });
		for (const facet of buildWigFacets(CATALOG, query).colorFamilies) {
			const matches = applyWigQuery(CATALOG, {
				...query,
				colorFamilies: [facet.value]
			});
			expect(matches.length).toBe(facet.count);
		}
	});

	it('narrows the counts by the search as well', () => {
		const facets = buildWigFacets(CATALOG, queryWith({ search: 'black' }));
		expect(facets.lengths.find((facet) => facet.value === 'long')?.count).toBe(1);
		expect(facets.lengths.find((facet) => facet.value === 'short')?.count).toBe(1);
	});

	it('does not let a dimension narrow its own counts, so a selection can always be undone', () => {
		const facets = buildWigFacets(CATALOG, queryWith({ lengths: ['short'] }));
		// 'long' still counts 2 even though 'short' is selected — otherwise the only way back to a
		// wider list would be to already know which chip to press.
		expect(facets.lengths.find((facet) => facet.value === 'long')?.count).toBe(2);
		expect(facets.lengths.find((facet) => facet.value === 'short')).toMatchObject({
			count: 1,
			selected: true
		});
	});

	it('marks exactly the selected values as selected', () => {
		const facets = buildWigFacets(CATALOG, queryWith({ colorFamilies: ['black', 'ombre'] }));
		expect(
			facets.colorFamilies.filter((facet) => facet.selected).map((facet) => facet.value)
		).toEqual(['black', 'ombre']);
	});

	it('returns no chips for an empty catalog', () => {
		expect(buildWigFacets([], DEFAULT_WIG_QUERY)).toEqual({
			lengths: [],
			hairTypes: [],
			colorFamilies: []
		});
	});
});

describe('toggleWigFacetValue', () => {
	it('adds a value that is absent and removes one that is present', () => {
		expect(toggleWigFacetValue<'short' | 'long'>([], 'short')).toEqual(['short']);
		expect(toggleWigFacetValue(['short', 'long'], 'short')).toEqual(['long']);
	});

	it('never mutates the array it was given', () => {
		const selected = ['short'];
		toggleWigFacetValue(selected, 'long');
		expect(selected).toEqual(['short']);
	});
});

describe('isWigQueryActive', () => {
	it('is false for the default query', () => {
		expect(isWigQueryActive(DEFAULT_WIG_QUERY)).toBe(false);
	});

	it('is false for a search of only whitespace', () => {
		expect(isWigQueryActive(queryWith({ search: '   ' }))).toBe(false);
	});

	it.each([
		['a search', { search: 'bob' }],
		['a length', { lengths: ['short' as const] }],
		['a hair type', { hairTypes: ['human' as const] }],
		['a colour', { colorFamilies: ['black' as const] }],
		['a non-default sort', { sort: 'name' as const }]
	])('is true for %s', (_label, overrides) => {
		expect(isWigQueryActive(queryWith(overrides))).toBe(true);
	});
});

describe('presentation helpers', () => {
	it('puts length, hair type and colour on the card line the catalog was hiding', () => {
		expect(wigDetailLine(CATALOG[3])).toBe('Extra long · Human hair · Black to Copper Ombre');
	});

	it('describes the result count, and says "of" only when something is filtered', () => {
		expect(describeWigMatches(4, 4)).toBe('4 wigs');
		expect(describeWigMatches(1, 4)).toBe('1 of 4 wigs');
		expect(describeWigMatches(0, 4)).toBe('0 of 4 wigs');
		expect(describeWigMatches(1, 1)).toBe('1 wig');
	});
});
