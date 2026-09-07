// Purpose: Force this route to be prerendered so a real HTML file exists at `/vault`.
// Why: The vault is the app's memory, and an installed copy that cannot open it offline would be
//      an app that loses your saved pages exactly when the network does — while the pages
//      themselves sit in this device's own storage, perfectly readable. `planPrecache` puts every
//      prerendered page in the critical set, so this one line is what gets the vault's shell into
//      the offline copy alongside the studio and the mode pages.
// Info flow: build -> prerendered /vault HTML -> $service-worker `prerendered` -> planPrecache
//            critical set -> cache.addAll.
// Invariants: Nothing here may depend on the request. The saved pages are read from this device
//             after hydration, never rendered into this file — see `+page.svelte`.
export const prerender = true;
