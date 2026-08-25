<!--
Purpose: State the provenance of the ProviderAdapterSeam contract fixtures.
Why: A reviewer must be able to tell live provider evidence from synthetic fixture data.
Info flow: capture origin -> reviewer expectations -> when to refresh.
-->

# Provider fixture provenance

`sample.json` and `fault.json` are **live captures**, taken 2026-08-25 by running
`node probes/provider-adapter.probe.mjs` against xAI with an authorized key. Each file
records this in its own `provenance` block with a timestamp, which is the authoritative
source; this document only explains it.

They are real evidence that the pinned models accept the probe's strict-schema envelope and
image request. They do not prove the deployed app's much larger Meechie prompt/schema payload:

- `sample.json` — chat returned `ok:true` for `grok-4.6` using the probe's one-field strict
  `json_schema` response format, and the image leg returned a payload for `grok-imagine-image`.
- `fault.json` — deliberately bad model ids, capturing the provider's own error text. This is
  what proves the adapter surfaces a real message (`Model not found: ...`) rather than the
  bare `Bad Request` that hid a retired-model outage.

**Account identifiers are redacted.** xAI embeds a team id in some access errors. The captured
text is rewritten to `[redacted-id]` here and by `redactProviderMessage` in the adapter,
because these messages are returned to API clients verbatim by the studio, tool and chat
pipelines.

To refresh, re-run the probe with an authorized `XAI_API_KEY`. It imports `TEXT_MODEL` and
`IMAGE_MODEL` from `src/lib/core/models.js`, so it always exercises the pinned ids, and it
imports the same `redactProviderMessage` helper as the runtime adapter before writing errors.
It rewrites both files with a new `provenance.kind` of `live-capture` and a fresh timestamp.
