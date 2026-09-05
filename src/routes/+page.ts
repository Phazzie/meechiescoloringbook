// Purpose: Load the wig catalog for the studio page on the server as well as the client.
// Why: The carousel used to read wigs.json as a module import, so the cards and their affiliate
//      links were in the server-rendered HTML. Moving the read onto WigCatalogSeam inside an
//      `$effect` moved it after hydration, which left the initial HTML showing only a loading line
//      — so a crawler, a reader with JavaScript off, or a failed hydration got no catalog and, more
//      to the point, none of the affiliate links this page exists to carry. A `load` runs in both
//      places, so the seam is still the only reader of the data and the markup comes back.
// Info flow: WigCatalogSeam.listWigs -> load -> +page.svelte -> WigTryOnStudio -> WigCarousel.
import { createWigCatalogSeam } from '$lib/adapters/wig-catalog-seam';
import type { Wig } from '$lib/seams/wig-catalog-seam/contract';

export type StudioPageData = {
	wigs: Wig[];
	wigCatalogError: string;
};

export const load = async (): Promise<StudioPageData> => {
	const result = await createWigCatalogSeam().listWigs();
	// A failed or empty catalog is reported, not swallowed: WIG_CATALOG_LOAD_FAILED and
	// WIG_CATALOG_EMPTY carry the reason, and the carousel renders it. Returning an error here
	// instead would take down the whole studio page for a wig list that is one section of it.
	return result.ok
		? { wigs: result.value, wigCatalogError: '' }
		: { wigs: [], wigCatalogError: result.error.message };
};
