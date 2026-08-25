// Purpose: Pin the xAI model ids used across every provider-backed seam.
// Why: A model id is not a secret and does not vary per environment, so it belongs in code
//      where a diff shows the change and a grep finds it. Plain checked JavaScript keeps the
//      same source directly importable by the repository's documented Node 20 probes.
// Info flow: these constants -> chat/tool/studio/image seams and probes -> provider request.
export const TEXT_MODEL = 'grok-4.6';
// Deliberately NOT upgraded to grok-imagine-image-2.0. Image generation is the one path
// that was working during the outage — POST /api/generate returned a real printable page in
// ~6s on 2026-08-24 — and 2.0's request-parameter compatibility could not be proven, because
// the preview deployment sits behind Vercel SSO. Shipping an unverified change to the only
// working path would risk trading a partial outage for a total one. The upgrade belongs in
// its own change, once a probe can actually reach a deployment.
export const IMAGE_MODEL = 'grok-imagine-image';
