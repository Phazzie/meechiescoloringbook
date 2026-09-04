// Purpose: Resolve the URL slug to a real mode before the focused-mode page renders.
// Why: The route used to hand every unrecognised slug to Random Meechie and answer 200, so a typo
//      or a renamed mode quietly served a different mode's page under the requested URL with
//      nothing on screen to say so. Resolving in `load` means an unknown slug is a 404 and a known
//      one arrives already resolved.
// Info flow: Route params -> resolveModeSlug -> mode slug in page data -> +page.svelte.
import { error } from '@sveltejs/kit';
import { resolveModeSlug } from '$lib/core/mode-catalog';
import type { PageLoad } from './$types';

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
