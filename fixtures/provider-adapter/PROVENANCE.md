<!--
Purpose: State the provenance of the ProviderAdapterSeam contract fixtures.
Why: Record exactly what the checked-in live captures prove and what remains unverified.
Info flow: Fixture origin -> reviewer expectations -> authenticated probe refresh.
-->

# Provider fixture provenance

`sample.json` and `fault.json` are live captures produced by the authenticated provider probe on 2026-08-25. They prove that `grok-4.6` accepted the probe's strict `json_schema` request, that `grok-imagine-image` returned image data, and that both intentional bad-model requests returned normalized provider errors. They do not prove that a reachable deployment accepts the much larger Meechie studio system prompt end to end.

Run `node probes/provider-adapter.probe.mjs` with an authorized xAI key to refresh both captures. The probe imports `TEXT_MODEL` and `IMAGE_MODEL` from the Node-20-compatible `src/lib/core/models.js`, sends the studio path's strict `json_schema` shape, and records `provenance.kind` as `live-capture` with a timestamp. It exits nonzero and leaves these fixtures unchanged when either sample response is HTTP-failed or empty, or when either intentional fault request unexpectedly succeeds.
