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
-->
<script lang="ts">
	import {
		VAULT_PATH,
		VAULT_SAVED_CONFIRMATION,
		vaultLinkFor
	} from '$lib/core/vault-page';

	let {
		status,
		testId
	}: {
		/** The surface's status line. Empty renders nothing at all. */
		status: string;
		/** This surface's id for the line, so two surfaces are addressable apart. */
		testId: string;
	} = $props();

	// The decision is in core, where it is unit-tested against the real failure messages this same
	// line carries. See `vaultLinkFor` for why it is an exact match and not a search.
	const link = $derived(vaultLinkFor(status));
	// A refusal is not good news, so it must not be rendered in the confirmation's green.
	const refused = $derived(!!link && status !== VAULT_SAVED_CONFIRMATION);
</script>

{#if status}
	<p class="status" class:refused data-testid={testId}>
		{status}
		{#if link}
			<a class="vault-link" href={VAULT_PATH} data-testid="{testId}-link">{link.text}</a>
		{/if}
	</p>
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
</style>
