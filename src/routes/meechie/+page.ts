// Purpose: Prerender this route so its HTML is a real file the service worker can cache.
// Why: Nothing on this page depends on the request — it renders from the mode catalog and the
//      reader's own typing, and every provider call happens after hydration. Rendering it once at
//      build time therefore produces the same document as rendering it per request, and it is what
//      puts this route in `$service-worker`'s `prerendered` list so an installed app can open it
//      with no network. Before this, the service worker cached 3.3 MB of pictures and zero bytes of
//      HTML, so every route was unreachable offline.
// Info flow: build -> prerendered HTML -> planPrecache critical set -> cache.addAll.
// Invariants: Add a request-dependent `load` here and this must come out, or the build will fail
//             telling you so.
export const prerender = true;
