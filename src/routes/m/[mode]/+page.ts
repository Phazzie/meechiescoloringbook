// Purpose: Provide typed mode params to the generic mode route.
// Why: Keep route data minimal while enabling slug-based mode selection.
// Info flow: Route params -> page data object -> +page.svelte configuration map.
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => ({
	mode: params.mode
});
