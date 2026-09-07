<!--
Purpose: The one control in this app that talks to a printer.
Why: Four surfaces told the reader to "Print it. Color it." and none of them could. This is the
     button those sentences were describing, shared by all of them so the label, the disabled rule
     and the saved-file name cannot drift into three different answers — which is exactly how the
     download row, the drift report and the vault save each came to behave differently on each
     surface before they were shared.
Info flow: how many finished pictures the surface is holding -> `describePrintJob` -> this button's
           label and disabled state -> `window.print()` under the page's own document title.
Invariant: this is the ONLY place in `src/` that calls `print()`. The decisions about what the
           button says and when it is off are in `$lib/core/print-sheet`, which is pure and tested;
           what is left here is the browser call and restoring the title afterwards. What actually
           comes out of the printer is not decided here either — that is the `@media print` block in
           `+layout.svelte`, which reveals the elements marked `data-print-sheet` and hides the app.
-->
<script module lang="ts">
	/**
	 * The document title to put back once the print job is done, or `null` when none is in flight.
	 *
	 * Module scope, not instance scope, because `document.title` is one global thing and the value
	 * being protected is "what it was before *any* of this started". Two facts make this necessary
	 * rather than tidy:
	 *
	 * 1. `print()` resolves as soon as the preview opens in several browsers, so a second print can
	 *    begin before the first `afterprint` arrives. Capturing the title per click would capture
	 *    the *already swapped* title the second time, and the restore would then put the page title
	 *    back rather than the app's — leaving it wrong permanently instead of briefly.
	 * 2. Registering a listener per click means several restores running on one event, in order,
	 *    with the last one winning. One pending restore, one listener.
	 */
	let pendingTitleRestore: string | null = null;
</script>

<script lang="ts">
	import { describePrintJob } from '$lib/core/print-sheet';

	let {
		sheetCount,
		pageTitle = null,
		testId
	}: {
		/** Finished pictures on this surface — one printed sheet each. */
		sheetCount: number;
		/**
		 * The page's own title, used as the print job's document title.
		 *
		 * That is the default filename the reader gets if they pick "Save as PDF" instead of a
		 * printer. `null` is a real answer — a surface with no title yet — and produces the
		 * fallback name rather than a guess.
		 */
		pageTitle?: string | null;
		testId: string;
	} = $props();

	const job = $derived(describePrintJob({ sheetCount, pageTitle }));

	const handlePrint = (): void => {
		if (!job.canPrint) return;
		// Guarded rather than assumed: a handful of embedded webviews ship without it. There is no
		// UI state for the case because there is nothing useful to say — and a disabled state for
		// it would have to be decided after hydration, on pages that are prerendered and replayed
		// from the service worker's cache offline.
		if (typeof globalThis.print !== 'function') return;

		// Restored on `afterprint`, not straight after `print()` returns. In several browsers
		// `print()` resolves as soon as the preview opens, so restoring there would rename the job
		// out from under the filename field the reader is still looking at. If a browser never
		// fires `afterprint` the tab keeps the page's title until the next navigation, which costs
		// the reader nothing.
		//
		// Only the first print of a burst captures and registers — see `pendingTitleRestore`.
		if (pendingTitleRestore === null) {
			pendingTitleRestore = globalThis.document.title;
			globalThis.addEventListener(
				'afterprint',
				() => {
					if (pendingTitleRestore !== null) {
						globalThis.document.title = pendingTitleRestore;
						pendingTitleRestore = null;
					}
				},
				{ once: true }
			);
		}
		globalThis.document.title = job.documentTitle;
		globalThis.print();
	};
</script>

<button
	type="button"
	class="print-button"
	data-testid={testId}
	onclick={handlePrint}
	disabled={!job.canPrint}
	aria-label={job.canPrint ? job.buttonLabel : `${job.buttonLabel} — ${job.blockedReason}`}
>
	{job.buttonLabel}
</button>

<style>
	/*
	 * Self-contained rather than inheriting each host's button styles: three surfaces host this and
	 * their `.ghost` rules are three separate declarations that already differ in padding. Matching
	 * the shared gold pill here means the control looks the same wherever the reader meets it.
	 */
	.print-button {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: rgba(201, 162, 39, 0.08);
		border: 1px solid var(--gold-border, rgba(201, 162, 39, 0.35));
		border-radius: 999px;
		padding: 0.6rem 1.1rem;
		color: var(--gold-bright, #f0c44a);
		font-family: inherit;
		font-size: 0.88rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease;
	}

	.print-button:hover:not(:disabled) {
		border-color: var(--gold, #c9a227);
		background: rgba(201, 162, 39, 0.15);
	}

	.print-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	/*
	 * The control must never print itself. It is inside the page it prints from, and although the
	 * `@media print` block in the layout hides everything that is not on the path to a sheet, this
	 * button can sit on that path — it is a sibling of the preview on two of the three surfaces.
	 */
	@media print {
		.print-button {
			display: none !important;
		}
	}
</style>
