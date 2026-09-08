// Purpose: Force this route to be prerendered so a real HTML file exists at `/describe`.
// Why: Every page route in this app is prerendered, and `planPrecache` puts each prerendered
//      document in the offline copy's critical set. A surface whose whole job is to take a
//      sentence and turn it into a page has nothing to show without a network — but the *shell*
//      still has to open, so the installed app explains that rather than failing to load at all.
// Info flow: build -> prerendered /describe HTML -> $service-worker `prerendered` -> planPrecache
//            critical set -> cache.addAll.
// Invariants: Nothing here may depend on the request. Both provider calls this surface makes
//             happen after hydration, so no `load` is needed and none may be added — adding one
//             that reads the request means removing this flag, and the build will say so.
export const prerender = true;
