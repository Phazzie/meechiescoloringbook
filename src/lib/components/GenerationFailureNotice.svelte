<!--
  Purpose: The only rendering of a failed AI call in the app — what happened, and the way back.
  Why: Five surfaces rendered `<p class="error">{someRawErrorString}</p>` and nothing else. The
       string was whatever the exception carried, so readers were shown `Failed to fetch` and
       `postJson: HTTP 502 Bad Gateway from /api/generate: empty response body`, and six of the
       app's own messages told them to try again with no control anywhere to do it. One component
       means the sentence, the wait and the retry are decided once.
  Info flow: GenerationFailure (from `classifyGenerationFailure`) + the live connection + the clock
             -> this notice -> the surface's `onRetry`.
  Invariants:
    - The retry button is rendered only when `retryControlLabel` returns one, and is enabled only
      when `canRetryAt` says so. A cause where retrying reproduces the same refusal gets no button,
      because pressing it would spend a paid generation to buy the identical failure back.
    - `failure.detail` is never rendered here. It exists for System Trace and a bug report; putting
      it back on screen would restore the exact defect this component was written to remove.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		canRetryAt,
		describeRetryWait,
		retryControlLabel,
		type GenerationFailure
	} from '$lib/core/generation-failure';
	import { connection } from './connection.svelte';
	import { clockSeam } from '$lib/adapters/clock-seam';
	import type { ClockSeam } from '$lib/seams/clock-seam/contract';

	let {
		failure,
		onRetry,
		isBusy = false,
		testId,
		clock = clockSeam
	}: {
		failure: GenerationFailure | null;
		/** Re-run exactly the request that failed. Omitted where a surface has nothing to re-run. */
		onRetry?: () => void;
		/** True while the surface is already working, so a retry cannot be double-fired. */
		isBusy?: boolean;
		testId?: string;
		clock?: ClockSeam;
	} = $props();

	/**
	 * Now, as this component understands it.
	 *
	 * A `rate_limited` failure names an instant in the future, and the button has to become usable
	 * when that instant arrives rather than when the reader next interacts. Advanced by a single
	 * `ClockSeam` timer armed at exactly that instant — not a ticking interval, because there is
	 * exactly one moment at which the answer changes.
	 */
	let nowMs = $state(0);

	onMount(() => {
		const stopWatchingConnection = connection.listen();
		return () => stopWatchingConnection();
	});

	// Read and re-armed whenever the failure changes, and cancelled on teardown. Only a `rate_limited`
	// failure names an instant, so this is also the only case where `nowMs` is consulted — which is
	// why it starts at 0 rather than at the clock: an unread clock cannot then be mistaken for a
	// window that has already reopened. Scheduling at an instant already past fires on the next tick,
	// which is right for a window that closed while the response was still arriving.
	$effect(() => {
		if (failure?.retry.kind !== 'after') return;
		nowMs = clock.now();
		const cancel = clock.scheduleAt(failure.retry.readyAtMs, () => {
			nowMs = clock.now();
		});
		return () => cancel();
	});

	const label = $derived(failure ? retryControlLabel(failure) : null);
	const wait = $derived(
		failure
			? describeRetryWait(failure, (date) =>
					date.toLocaleTimeString([], {
						hour: 'numeric',
						minute: '2-digit',
						second: '2-digit'
					})
				)
			: ''
	);
	const retryUsable = $derived(
		failure !== null && canRetryAt(failure, nowMs, connection.isOnline)
	);
</script>

{#if failure}
	<div class="failure" role="alert" data-testid={testId}>
		<p class="failure-message">{failure.message}</p>
		{#if wait}
			<p class="failure-wait" data-testid={testId ? `${testId}-wait` : undefined}>
				{wait}
			</p>
		{/if}
		{#if label && onRetry}
			<button
				type="button"
				class="failure-retry"
				data-testid={testId ? `${testId}-retry` : undefined}
				onclick={onRetry}
				disabled={!retryUsable || isBusy}
			>
				{label}
			</button>
		{/if}
	</div>
{/if}

<style>
	/* Owns its styling rather than inheriting `.studio .error`, which is why the old error box
	   stayed one page's alone: the markup was copyable and the CSS was not. */
	.failure {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.6rem;
		margin: 0.6rem 0;
		padding: 0.75rem 0.85rem;
		border: 1px solid rgba(255, 100, 140, 0.38);
		border-left: 3px solid #ff5f8f;
		border-radius: 6px;
		background: rgba(60, 8, 24, 0.42);
	}

	.failure-message {
		margin: 0;
		color: #ffb3c9;
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.failure-wait {
		margin: 0;
		color: rgba(255, 179, 201, 0.78);
		font-size: 0.82rem;
	}

	.failure-retry {
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

	.failure-retry:hover:not(:disabled) {
		background: rgba(201, 162, 39, 0.14);
	}

	.failure-retry:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
