// Purpose: Resolve the URL slug to a real mode before the focused-mode page renders.
// Why: The route used to hand every unrecognised slug to Random Meechie and answer 200, so a typo
//      or a renamed mode quietly served a different mode's page under the requested URL with
//      nothing on screen to say so. Resolving in `load` means an unknown slug is a 404 and a known
//      one arrives already resolved.
// Info flow: Route params -> resolveModeSlug -> mode slug in page data -> +page.svelte.
import { error } from '@sveltejs/kit';
import { modeCatalog, resolveModeSlug } from '$lib/core/mode-catalog';
import type { EntryGenerator, PageLoad } from './$types';

// `'auto'` rather than `true`, and the distinction is the alias behaviour this route already has.
// `true` would prerender the slugs `entries` names and answer 404 at the CDN for anything else —
// including every alias `resolveModeSlug` accepts, which resolve to real modes today. `'auto'`
// prerenders the canonical slugs *and* keeps the route in the server manifest, so an alias still
// reaches `load` and still resolves. The prerendered documents are what the service worker caches,
// so all eight modes open with no network; an alias needs the network, which is the honest
// trade and is why it is not silently made to look otherwise.
export const prerender = 'auto';

// Canonical slugs only. An alias is a second URL for a page that is already in this list, so
// prerendering it would file a second copy of identical HTML under a name nothing links to.
export const entries: EntryGenerator = () => modeCatalog().map((mode) => ({ mode: mode.slug }));

export const load: PageLoad = ({ params }) => {
	const config = resolveModeSlug(params.mode);
	if (!config) {
		error(404, `There is no Meechie mode called "${params.mode}".`);
	}
	// The canonical slug, not the requested one: an alias resolves to the mode it names, and
	// everything downstream — the download filename included — should use the real one. The config
	// itself is not returned because it carries `buildInput`, a function, which cannot survive
	// serialization from a server-side load.
	return { mode: config.slug };
};
