<!--
Purpose: What a surface says after a page reaches the vault — and, when it did, a way to go there.
Why: Twelve of the thirteen page-making surfaces ended a successful save with "Saved to the vault.
     Find it on the home page." That sentence was accurate and useless: it named a destination and
     gave no way to get to it, on the twelve screens furthest from it. The home studio said
     something different again ("Saved to the quote vault."), so the same event had two wordings and
     neither was a link. One component, so the confirmation and the way out of it cannot drift apart
     again.
Info flow: A status string from the surface's own state -> rendered; when it is the save
     confirmation exactly, the vault link is rendered beside it.
Invariants: The link appears only for sentences this app wrote, matched exactly, never for an
     arbitrary status. Most failures carry no link, because "see all your saved pages" under an
     error that says the save failed would be an invitation to go and look at nothing — but the two
     refusals that mean "the vault is full" carry one that says "make room", because for those the
     vault is not somewhere to browse, it is where the remedy is.
     The retry control is rendered only when the surface supplies a failure whose classification
     offers one, and never for the confirmation: a save that worked has nothing to redo, and a save
     refused for room would be refused identically a second later.
-->
<script lang="ts">
	import {
		VAULT_PATH,
		VAULT_SAVED_CONFIRMATION,
		vaultLinkFor
	} from '$lib/core/vault-page';
	import { storageRetryLabel, type StorageFailure } from '$lib/core/storage-failure';

	let {
		status,
		testId,
		failure = null,
		onRetry,
		isBusy = false
	}: {
		/** The surface's status line. Empty renders nothing at all. */
		status: string;
		/** This surface's id for the line, so two surfaces are addressable apart. */
		testId: string;
		/**
		 * The classified failure behind this line, where the line is reporting one.
		 *
		 * Null on a confirmation, on "Saving...", and on the surfaces that have not been given one.
		 * The status text still comes from `status`, which is the same sentence — this carries only
		 * the part `status` cannot express, which is whether pressing again could land differently.
		 */
		failure?: StorageFailure | null;
		/** Re-run the save that failed. Omitted where a surface has nothing to re-run. */
		onRetry?: () => void;
		/** True while the surface is already saving, so the retry cannot be double-fired. */
		isBusy?: boolean;
	} = $props();

	// The decision is in core, where it is unit-tested against the real failure messages this same
	// line carries. See `vaultLinkFor` for why it is an exact match and not a search.
	const link = $derived(vaultLinkFor(status));
	// A refusal is not good news, so it must not be rendered in the confirmation's green.
	const refused = $derived(!!link && status !== VAULT_SAVED_CONFIRMATION);
	const retryLabel = $derived(failure ? storageRetryLabel(failure, 'save') : null);
</script>

{#if status}
	<p class="status" class:refused data-testid={testId}>
		{status}
		{#if link}
			<!--
				A refusal's link opens in a NEW tab; the confirmation's does not. The difference is
				the page on screen. After a successful save there is nothing left to lose, so
				navigating away is what the reader wants. After a refusal the page is unsaved, was
				paid for with a generation, and lives only in this route's memory — the mode and
				describe routes dispose their state on navigation, and the home studio's draft
				stores neither the image nor the exports. So a same-tab "Make room in the vault"
				destroyed the very page it was offering to make room for, before the reader could
				free a slot and press Save again.
			-->
			<a
				class="vault-link"
				href={VAULT_PATH}
				data-testid="{testId}-link"
				target={refused ? '_blank' : undefined}
				rel={refused ? 'noopener' : undefined}>{link.text}</a
			>
		{/if}
	</p>
	{#if retryLabel && onRetry}
		<button
			type="button"
			class="status-retry"
			data-testid="{testId}-retry"
			onclick={onRetry}
			disabled={isBusy}
		>
			{retryLabel}
		</button>
	{/if}
{/if}

<style>
	/* Owns its own look rather than inheriting a `.status` rule from whichever page happens to host
	   it — the same reason `VaultGallery` carries its own styling. Three hosts, one appearance. */
	.status {
		margin: 0.7rem 0 0;
		color: var(--emerald);
		font-weight: 700;
	}

	/* A full vault is the one refusal on this line that carries a link, so it is also the one that
	   could be mistaken for the confirmation at a glance — same shape, same link, same green.
	   `--gold` rather than `--gold-bright`, which the link beside it uses: the sentence has to read
	   as "not saved", and the link still has to be the brightest thing in the line. */
	.status.refused {
		color: var(--gold);
	}

	.vault-link {
		color: var(--gold-bright);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.vault-link:hover {
		color: var(--cream);
	}

	/* Matches `StorageFailureNotice`'s control, because it does the same job for the same reason on
	   a different line. Two shapes for one action would read as two different actions. */
	.status-retry {
		margin-top: 0.5rem;
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

	.status-retry:hover:not(:disabled) {
		background: rgba(201, 162, 39, 0.14);
	}

	.status-retry:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
