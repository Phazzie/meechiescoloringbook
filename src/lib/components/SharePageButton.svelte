<!--
Purpose: The one control in this app that hands a coloring page to another app.
Why: `/random` and `/meechie` both end with "Print it. Color it. Send it to whoever needs to see
     it." Run 13 made the first two clauses true. Nothing in this repository had ever made the third
     true — `navigator.share` appeared nowhere in `src/`, and `studioActions` lists twelve things a
     reader can do with a finished page, none of which is sending one. The only route to somebody
     else's phone was: download a file, leave the app, find it, attach it by hand.
Info flow: the export row this surface is already showing (+ the page's title and Meechie's line)
           -> `describeShareJob` -> this button's label and disabled state -> `navigator.share` with
           the picture, or the clipboard when this browser has no share sheet.
Invariant: this is the ONLY place in `src/` that calls `navigator.share`, `navigator.canShare` or
           `navigator.clipboard.write`. Every decision about what is sent, what the button says and
           what the reader is told afterwards lives in `$lib/core/share-page`, which is pure and
           tested; what is left here is the browser call. Same split as `PrintPageButton.svelte` and
           `$lib/core/print-sheet`.
-->
<script lang="ts">
	import {
		chooseShareExports,
		decodeDataUrl,
		describeShareFailure,
		describeShareJob,
		isShareCancellation,
		SHARE_COPIED,
		SHARE_SENT,
		SHARE_UNREADABLE_DETAIL,
		SHARE_UNSUPPORTED,
		type ShareCapability
	} from '$lib/core/share-page';
	import type { PageExport } from '$lib/core/page-exports';

	let {
		exports,
		pageTitle = null,
		quote = null,
		testId
	}: {
		/** The export row this surface is showing — the same files its download links point at. */
		exports: readonly PageExport[];
		/** The page's own title, which travels with the picture. */
		pageTitle?: string | null;
		/** What Meechie said, if this surface has a line for it. Sent as the message body. */
		quote?: string | null;
		testId: string;
	} = $props();

	/**
	 * What this browser can do, as measured from this browser.
	 *
	 * Starts at `'none'` and is corrected on mount, which is safe here in a way it would not be
	 * elsewhere: every page route in this app is prerendered and the service worker replays those
	 * documents offline, so a capability baked into the built HTML would be the *build machine's*.
	 * Nothing is lost by starting pessimistic, because a prerendered document has no finished page
	 * in it either — `describeShareJob` reports "no page" before it reports "no capability", so the
	 * built document and the freshly hydrated one say the same sentence.
	 */
	let capability = $state<ShareCapability>('none');
	let shareStatus = $state('');

	/**
	 * Which of the two paths this browser has, if either.
	 *
	 * `navigator.canShare` is required alongside `navigator.share`: without it there is no way to
	 * ask whether a *file* payload is acceptable before sending one, and Level 1 implementations
	 * accept `{ title, text }` while throwing on `{ files }`. Measured in this project's own test
	 * browser: Chromium 1194 on Linux has neither, and has the clipboard — which is why the
	 * fallback is part of the feature rather than a nicety.
	 */
	/** Whether this browser will take an image on the clipboard at all. */
	const clipboardAvailable = (): boolean =>
		typeof ClipboardItem === 'function' && typeof navigator.clipboard?.write === 'function';

	const detectCapability = (): ShareCapability => {
		if (typeof navigator === 'undefined') return 'none';
		if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
			return 'files';
		}
		return clipboardAvailable() ? 'clipboard-image' : 'none';
	};

	// No reactive reads, so this runs once, in the browser, after mount.
	$effect(() => {
		capability = detectCapability();
	});

	const job = $derived(describeShareJob({ exports, pageTitle, quote, capability }));

	/**
	 * A stable name for the page currently on offer.
	 *
	 * Keyed on the filenames rather than on the `exports` array itself: a `$derived` array is a new
	 * reference every time anything upstream recomputes, and an effect watching the reference would
	 * wipe the confirmation the reader is still reading. A `$derived` string is compared by value,
	 * so this changes only when the page does.
	 */
	const pageKey = $derived(exports.map((item) => item.filename).join('|'));
	/** The page the confirmation on screen belongs to. */
	let statusPageKey = '';

	// A new page means the last send's confirmation is about a page nobody is looking at any more.
	$effect(() => {
		if (pageKey === statusPageKey) return;
		statusPageKey = pageKey;
		shareStatus = '';
	});

	/**
	 * Turn export rows into files, synchronously.
	 *
	 * Synchronously is the load-bearing word. `navigator.share` requires transient user activation,
	 * and awaiting anything before calling it spends that activation in several browsers — the
	 * share sheet then never opens and the promise rejects for a reason that has nothing to do with
	 * the page. Everything needed is already in memory as a `data:` URL, so no await is required to
	 * get here, and none is taken.
	 */
	const toFiles = (rows: readonly PageExport[]): File[] => {
		const files: File[] = [];
		for (const row of rows) {
			const decoded = decodeDataUrl(row.href);
			if (decoded === null) continue;
			files.push(
				new File([decoded.bytes as BlobPart], row.filename, { type: decoded.mimeType })
			);
		}
		return files;
	};

	/**
	 * What the reader is told when a send rejects.
	 *
	 * One function rather than a branch in each of the two catch blocks: the rule that a dismissed
	 * sheet is silent and a real failure is not has to be the same rule on both paths, and two
	 * copies of it are two chances to get one of them wrong.
	 */
	const outcomeForRejection = (error: unknown): string => {
		const name = error instanceof Error ? error.name : '';
		const message = error instanceof Error ? error.message : '';
		return isShareCancellation(name) ? '' : describeShareFailure(message);
	};

	/**
	 * Put one PNG on the clipboard. The path for every browser with no share sheet.
	 *
	 * It makes its own selection rather than reusing the job's, because it is also the landing place
	 * for a share sheet that looked at the job's files and refused them — and those may be a PDF,
	 * which no clipboard takes. `chooseShareExports` is the one place that rule lives.
	 */
	const copyPicture = async (): Promise<void> => {
		const rows = chooseShareExports(exports, 'clipboard-image');
		if (rows.length === 0 || !clipboardAvailable()) {
			shareStatus = SHARE_UNSUPPORTED;
			return;
		}
		const files = toFiles(rows);
		if (files.length === 0) {
			// There was a file to copy and its bytes could not be read back. That is this app's
			// fault, not the browser's, and it is not the same answer as "this browser cannot".
			shareStatus = describeShareFailure(SHARE_UNREADABLE_DETAIL);
			return;
		}
		try {
			await navigator.clipboard.write([new ClipboardItem({ [files[0].type]: files[0] })]);
			shareStatus = SHARE_COPIED;
		} catch (error) {
			// A clipboard write the reader dismissed, or one a permission prompt refused, is not a
			// broken page and is not reported as one.
			shareStatus = outcomeForRejection(error);
		}
	};

	/** Hand the share sheet the files, and say what came back. */
	const shareFiles = async (files: File[]): Promise<void> => {
		try {
			await navigator.share({ files, title: job.payload.title, text: job.payload.text });
			shareStatus = SHARE_SENT;
		} catch (error) {
			// Backing out of the share sheet rejects with `AbortError`. It is the reader choosing
			// nothing, not a failure, and saying "could not send" there is the classic defect this
			// branch exists to avoid.
			shareStatus = outcomeForRejection(error);
		}
	};

	const handleSend = async (): Promise<void> => {
		if (!job.canSend) return;
		shareStatus = '';

		if (job.method === 'web-share') {
			const files = toFiles(job.payload.files);
			if (files.length === 0) {
				shareStatus = describeShareFailure(SHARE_UNREADABLE_DETAIL);
				return;
			}
			// Asked of the browser rather than assumed: a share sheet can accept files in general
			// and refuse these ones. `canShare` is synchronous, so the activation survives it.
			if (navigator.canShare({ files })) {
				await shareFiles(files);
				return;
			}
		}

		// Either this browser has no share sheet, or it looked at those exact files and refused
		// them. Both end in the same place, and the confirmation says which one happened by naming
		// the clipboard rather than the send. The bytes are decoded here rather than reused: the
		// clipboard's selection is not always the share sheet's.
		await copyPicture();
	};
</script>

<div class="share-control">
	<button
		type="button"
		class="share-button"
		data-testid={testId}
		data-share-method={job.method}
		onclick={handleSend}
		disabled={!job.canSend}
		aria-label={job.canSend ? job.buttonLabel : `${job.buttonLabel} — ${job.blockedReason}`}
	>
		{job.buttonLabel}
	</button>
	{#if shareStatus}
		<!-- `role="status"` because nothing else on screen changes when a send succeeds: the picture,
		     the downloads and the vault all stay exactly as they were, so a reader who cannot see
		     this line has no way to know whether anything happened. -->
		<p class="share-status" data-testid={`${testId}-status`} role="status">{shareStatus}</p>
	{/if}
</div>

<style>
	/*
	 * Column rather than a bare button: the confirmation belongs to this control and travels with
	 * it, so a surface hosting it does not have to wire a status line of its own — which is exactly
	 * how the download row, the drift report and the vault save each ended up behaving differently
	 * on each surface before they were shared.
	 */
	.share-control {
		display: inline-flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.35rem;
	}

	/*
	 * Self-contained rather than inheriting each host's button styles, for the same reason
	 * `PrintPageButton` is: three surfaces host this and their `.ghost` rules already differ in
	 * padding. This is the gold pill the print control uses, so the two sit together as a pair.
	 */
	.share-button {
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

	.share-button:hover:not(:disabled) {
		border-color: var(--gold, #c9a227);
		background: rgba(201, 162, 39, 0.15);
	}

	.share-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.share-status {
		margin: 0;
		font-size: 0.8rem;
		color: rgba(253, 246, 227, 0.72);
		max-width: 22rem;
	}

	/*
	 * The control must never print itself, for the same reason the print button must not: it can sit
	 * on the path to a marked sheet, and the layout's structural `@media print` rule deliberately
	 * keeps every ancestor of a sheet visible.
	 */
	@media print {
		.share-control {
			display: none !important;
		}
	}
</style>
