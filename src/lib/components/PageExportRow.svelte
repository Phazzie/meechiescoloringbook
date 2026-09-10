<!--
Purpose: The one export row in this app — every way a finished coloring page can leave it, each
         download saying what it is, what it is for and how big it is, plus the one sentence naming
         anything that could not be packaged.
Why: Run 6 rebuilt this row for the home studio and put the decisions behind it in
     `$lib/core/page-exports`. Exactly one surface ever used it. The other twelve — the three
     standalone mode routes and the eight `/m/<slug>` pages through `VerdictPageStudio`, and the
     eleven-tool hub — kept the row it replaced: `{#each packagedFiles as file}` with
     `{file.filename}` as the link text. Measured in a real browser on `main` at `7fbb57d`,
     `/who-fucked-up` offered two links reading `meechie-who-fucked-up-1788784316892.pdf` and
     `meechie-who-fucked-up-1788784316892-square.png`, no way at all to get the provider's own
     image, and a packaging failure rendered in the crimson `.error` box that a failed *generation*
     uses — directly under the button that buys another one. The home page, from the same page, in
     the same browser, offered three links reading "Printable PDF · US Letter — ready to print ·
     946 B".
Info flow: described exports + the packaging attempts -> this row -> download links, a notice
           naming what could not be built, and the control that builds it again.
Invariant: this component decides nothing. What each download is called, what it is for, how big it
           is, how a failure is worded and whether a rebuild is offered all come from
           `$lib/core/page-exports` and `$lib/core/export-failure`, which are pure and tested.
           Nothing here reads a filename to work out what a file is — the export row carries the
           variant it was packaged as, for the reason that module gives at length.
           `failure.detail` is never rendered: it is the seam's or an exception's own words, and
           putting it on screen restores the exact defect this row was rebuilt to remove.
-->
<script lang="ts">
	import {
		pageExportFailures,
		pageExportRetryLabel,
		summarisePageExportFailures,
		type PageExport,
		type PageExportAttempt
	} from '$lib/core/page-exports';

	let {
		exports,
		attempts = [],
		onRebuild,
		isRebuilding = false,
		emptyMessage = 'Make a page — its printable PDF, its share image and the original all land here.',
		testIdPrefix
	}: {
		/** Every file this page can be taken away as, already described. */
		exports: readonly PageExport[];
		/**
		 * What each packaging call was asked for and what it produced.
		 *
		 * The whole attempt rather than a pre-rendered sentence, because the notice needs the retry
		 * advice too — the same move `GenerationFailureNotice` and `StorageFailureNotice` made.
		 * Deliberately separate from any generation error the host is showing: packaging runs after
		 * the paid generation has already succeeded, so a failure here never means the page failed.
		 */
		attempts?: readonly PageExportAttempt[];
		/**
		 * Re-run packaging for the page already on screen. Omitted where a surface has nothing to
		 * re-run.
		 *
		 * Free by construction — the picture is in memory and packaging never touches the network —
		 * which is why this is the one retry in the app offered without a cost to weigh.
		 */
		onRebuild?: () => void;
		/** True while a rebuild or a generation is already running, so it cannot be double-fired. */
		isRebuilding?: boolean;
		/** What the row says before there is a page. Surfaces differ in what they packaged. */
		emptyMessage?: string;
		/**
		 * Prefix for this surface's test ids and the heading's `id`, e.g. `home` produces
		 * `home-export-list`. Every surface needs its own because two of them can be on one page,
		 * and an `aria-labelledby` pointing at a duplicated id resolves to whichever came first.
		 */
		testIdPrefix: string;
	} = $props();

	const headingId = $derived(`${testIdPrefix}-export-heading`);
	const opening = $derived(summarisePageExportFailures(attempts));
	const failures = $derived(pageExportFailures(attempts));
	const rebuildLabel = $derived(pageExportRetryLabel(attempts));
</script>

<!-- Labelled with the same words it shows, so what a screen reader announces and what a sighted
     reader sees are one string rather than two that can drift apart. -->
<section class="exports" aria-labelledby={headingId}>
	<p class="export-heading" id={headingId}>Take it with you</p>
	{#if exports.length > 0}
		<ul class="export-list" data-testid={`${testIdPrefix}-export-list`}>
			<!-- Deliberately unkeyed. Filenames are unique by construction today, but a key that turns
			     out to be duplicated is a runtime error in Svelte, and this list is three rows long —
			     there is nothing for a key to buy. -->
			{#each exports as item}
				<li>
					<a
						class="export-link"
						data-testid={`${testIdPrefix}-export-link`}
						data-export-kind={item.kind}
						href={item.href}
						download={item.filename}
					>
						<span class="export-label">{item.label}</span>
						<span class="export-meta">{item.purpose} · {item.sizeLabel}</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="export-empty" data-testid={`${testIdPrefix}-export-empty`}>{emptyMessage}</p>
	{/if}
	{#if failures.length > 0}
		<!-- A notice, not an error: the page above it is finished and worth keeping. Styled and
		     worded apart from a generation failure so nobody reads a failed PDF as a failed
		     generation and pays for a second one. -->
		<div class="export-notice" data-testid={`${testIdPrefix}-export-error`} role="status">
			<p class="export-notice-line">{opening}</p>
			<!-- One line per failed variant rather than one run-on sentence. Two variants can fail for
			     two different reasons — one rebuildable, one not — and the reader has to be able to
			     tell which line belongs to which download. -->
			{#each failures as failure}
				<p class="export-notice-line" data-export-failure-variant={failure.variant}>
					{failure.message}
				</p>
			{/each}
			{#if rebuildLabel && onRebuild}
				<button
					type="button"
					class="export-rebuild"
					data-testid={`${testIdPrefix}-export-rebuild`}
					onclick={onRebuild}
					disabled={isRebuilding}
				>
					{rebuildLabel}
				</button>
			{/if}
		</div>
	{/if}
</section>

<style>
	/*
	 * Self-contained. These rules used to live in `+page.svelte` as `:global(.studio .export-*)`,
	 * which is exactly why only one surface had this row: the markup was reachable by copying and
	 * the styling was not. Owning both here is what makes a fourteenth surface a two-line change
	 * rather than a fourth divergent copy.
	 *
	 * Each download is two lines — what it is, then what it is for and how big — because a row of
	 * identical-looking buttons is what let this panel print the same constant label once per file
	 * without anyone noticing. The list is a real `<ul>` so a screen reader is told how many ways
	 * out of the app there are before reading them.
	 */
	.exports {
		margin-top: 1rem;
		padding-top: 0.9rem;
		border-top: 1px solid rgba(201, 162, 39, 0.16);
	}

	/*
	 * The label type the studio gives every eyebrow, restated rather than inherited: the host's rule
	 * is `:global(.studio .eyebrow)`, so a row on any surface that is not the home studio would have
	 * rendered in the body font.
	 */
	.export-heading {
		margin: 0 0 0.5rem;
		font-family: var(--font-label, sans-serif);
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--gold, #c9a227);
	}

	.export-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.export-link {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.15rem;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		min-height: 40px;
		padding: 0.55rem 0.7rem;
		border: 1px solid rgba(201, 162, 39, 0.32);
		border-radius: 6px;
		background: rgba(7, 7, 15, 0.58);
		color: var(--gold-bright, #f0c44a);
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.export-label {
		font-family: var(--font-label, sans-serif);
		font-size: 0.76rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--gold-bright, #f0c44a);
	}

	/* Sentence case and unspaced against the label above it, which carries the uppercase label type.
	   The size and purpose are read, not scanned. */
	.export-meta {
		font-size: 0.68rem;
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
		color: var(--lavender, #b8aacf);
	}

	.export-empty {
		margin: 0;
		font-size: 0.8rem;
		font-style: italic;
		color: var(--lavender, #b8aacf);
	}

	/* Gold, not the error pink: what it reports is a missing download, above a page that is finished
	   and still worth keeping. The left rule and the button below match `StorageFailureNotice`, so a
	   reader does not learn a third visual language for "this did not work". */
	.export-notice {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.45rem;
		margin: 0.7rem 0 0;
		padding: 0.6rem 0.7rem;
		border: 1px solid rgba(201, 162, 39, 0.32);
		border-left: 3px solid var(--gold, #c9a227);
		border-radius: 6px;
		background: rgba(201, 162, 39, 0.09);
		color: var(--gold-bright, #f0c44a);
		font-size: 0.8rem;
	}

	.export-notice-line {
		margin: 0;
		line-height: 1.45;
	}

	.export-rebuild {
		margin-top: 0.15rem;
		padding: 0.5rem 0.9rem;
		border: 1px solid rgba(201, 162, 39, 0.42);
		border-radius: 6px;
		background: rgba(7, 7, 15, 0.62);
		color: var(--gold-bright, #f0c44a);
		font-family: var(--font-label, sans-serif);
		font-weight: 700;
		font-size: 0.76rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: background 0.12s;
	}

	.export-rebuild:hover:not(:disabled) {
		background: rgba(201, 162, 39, 0.14);
	}

	.export-rebuild:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/*
	 * A row of download links is not a coloring page. The layout's structural print rule keeps every
	 * ancestor of a marked sheet visible, and on two of these surfaces this row is inside one.
	 */
	@media print {
		.exports {
			display: none !important;
		}
	}
</style>
