<!--
Purpose: The one rendering of a quota sentence anywhere in the app.
Why: The sentence existed in two places with two sets of styles, and on eleven other surfaces not at
     all. A shared component is what makes "every surface that spends a bucket says so" a property
     of the app rather than a thing each surface has to remember.
Info flow: AiQuotaMeter.textMessage / .pictureMessage -> `message` prop -> this line.
Invariants:
  - Renders nothing at all for an empty message. Before the server has reported a quota there is
    genuinely nothing to say, and saying nothing is the point: this feature replaced a counter that
    made numbers up.
  - `aria-live="polite"` because the number changes underneath a reader who is not looking at it —
    it updates on each response, including the refusal that explains why nothing happened.
-->
<script lang="ts">
	let {
		message,
		testId = undefined,
		id = undefined
	}: {
		/** The already-worded sentence. Empty string when the server has reported no quota yet. */
		message: string;
		/** Optional hook so a surface's own test can find its own line. */
		testId?: string;
		/**
		 * Target for the `aria-describedby` on the button this line explains.
		 *
		 * The app's convention, asserted by `tests/e2e/smoke.spec.ts`: a button gated by a quota
		 * points at the sentence that says why. A line rendered next to a button but not referenced
		 * by it is visible to a sighted reader and absent for everyone else.
		 */
		id?: string;
	} = $props();
</script>

{#if message}
	<p class="ai-quota" {id} data-testid={testId} aria-live="polite">{message}</p>
{/if}

<style>
	/*
	  Deliberately quieter than the surface's own controls: this is the one number the reader can do
	  nothing about except wait. Owned here rather than inherited from `.studio`, which is why the
	  meter could never leave the home page before — the markup was reachable by copying and the
	  styling was not.
	*/
	.ai-quota {
		margin: 0.35rem 0 0;
		font-size: 0.84rem;
		font-weight: 600;
		color: var(--gold-bright, #f0c44a);
		opacity: 0.85;
	}
</style>
