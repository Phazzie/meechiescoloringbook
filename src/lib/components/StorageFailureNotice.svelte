<!--
  Purpose: The only rendering of a failed storage operation in the app — what happened, and the way
           back where there is one.
  Why: Nine call sites rendered `<p class="error">{someRawString}</p>` and nothing else, and two of
       those strings came from a caught exception. Readers were shown
       `Creation store requires a browser environment.` and `Stored creations are not an array.`,
       neither of which names a remedy, and none of the nine offered a way to try again — on the one
       kind of failure in this app where trying again is free. One component means the sentence and
       the retry are decided once, for the vault card, the `/vault` page, the four save surfaces and
       the studio's draft.
  Info flow: StorageFailure (from `classifyStorageFailure`) + the operation it came from
             -> this notice -> the surface's `onRetry`.
  Invariants:
    - The retry button is rendered only when `storageRetryLabel` returns one, which is only for the
      causes where a second attempt could land differently. Under every other cause the sentence
      carries the remedy and a button would be a lie about what pressing it does.
    - `failure.detail` is never rendered. It is the adapter's or the exception's own words, kept for
      System Trace and a bug report; putting it on screen restores the exact defect this component
      was written to remove.
    - Owns its styling rather than inheriting `.studio .error`. Every previous shared piece of this
      app stayed on one page because its markup was copyable and its CSS was not.
-->
<script lang="ts">
	import {
		storageRetryLabel,
		type StorageFailure,
		type StorageOperation
	} from '$lib/core/storage-failure';

	let {
		failure,
		operation,
		onRetry,
		isBusy = false,
		testId
	}: {
		failure: StorageFailure | null;
		/** Which operation failed. Decides the button's wording, so it names what it will redo. */
		operation: StorageOperation;
		/** Re-run exactly the operation that failed. Omitted where a surface has nothing to re-run. */
		onRetry?: () => void;
		/** True while the surface is already working, so a retry cannot be double-fired. */
		isBusy?: boolean;
		testId?: string;
	} = $props();

	const label = $derived(failure ? storageRetryLabel(failure, operation) : null);
</script>

{#if failure}
	<div class="storage-failure" role="alert" data-testid={testId}>
		<p class="storage-failure-message">{failure.message}</p>
		{#if label && onRetry}
			<button
				type="button"
				class="storage-failure-retry"
				data-testid={testId ? `${testId}-retry` : undefined}
				onclick={onRetry}
				disabled={isBusy}
			>
				{label}
			</button>
		{/if}
	</div>
{/if}

<style>
	/* Deliberately the same shape as `GenerationFailureNotice`: a reader should not have to learn
	   two visual languages for "this did not work". The left rule is gold rather than pink because
	   these failures are about this device rather than about a paid call that went wrong, and
	   because several of them are refusals a reader can act on rather than errors. */
	.storage-failure {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.6rem;
		margin: 0.6rem 0;
		padding: 0.75rem 0.85rem;
		border: 1px solid rgba(201, 162, 39, 0.34);
		border-left: 3px solid var(--gold, #c9a227);
		border-radius: 6px;
		background: rgba(38, 28, 6, 0.42);
	}

	.storage-failure-message {
		margin: 0;
		color: var(--cream, #f4ece0);
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.storage-failure-retry {
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

	.storage-failure-retry:hover:not(:disabled) {
		background: rgba(201, 162, 39, 0.14);
	}

	.storage-failure-retry:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
