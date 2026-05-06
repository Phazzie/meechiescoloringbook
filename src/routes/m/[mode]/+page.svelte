<!--
Purpose: Provide one generic route that maps named mode slugs to Meechie tool inputs.
Why: Centralize mode architecture so new modes reuse the same component and `/api/tools` request path.
Info flow: URL mode slug -> mode config -> MeechieModePage -> /api/tools response.
-->
<script lang="ts">
	import MeechieModePage from '$lib/components/MeechieModePage.svelte';
	import type { ModeConfig } from '$lib/components/meechie-mode-config';

	export let data: { mode: string };

	const randomConfig: ModeConfig = {
		title: 'Random Meechie',
		subhead: 'One tap. One truth. No context needed.',
		button: 'Get Random Meechie',
		fieldLabels: {},
		buildInput: () => ({ toolId: 'random_meechie' })
	};

	const modeConfigs: Record<string, ModeConfig> = {
		'who-fucked-up': {
			title: 'Who Fucked Up',
			subhead: 'Describe what happened. Meechie names what it really means.',
			button: 'Get the Read',
			fieldLabels: { situation: 'What happened?' },
			buildInput: (fields) => ({ toolId: 'red_flag_or_run', situation: fields.situation })
		},
		'rate-his-excuse': {
			title: 'Rate His Excuse',
			subhead: 'Drop the excuse. Meechie scores it with no soft landing.',
			button: 'Rate Excuse',
			fieldLabels: { excuse: 'Excuse to rate' },
			buildInput: (fields) => ({ toolId: 'rate_excuse', excuse: fields.excuse })
		},
		'apology-translator': {
			title: 'Apology Translator',
			subhead: 'Paste the apology and get the translation.',
			button: 'Translate Apology',
			fieldLabels: { apology: 'Apology text' },
			buildInput: (fields) => ({ toolId: 'apology_translator', apology: fields.apology })
		},
		random: randomConfig,
		'caption-this': {
			title: 'Caption This',
			subhead: 'Describe the moment and get a statement caption.',
			button: 'Drop Caption',
			fieldLabels: { moment: 'Describe the moment' },
			buildInput: (fields) => ({ toolId: 'caption_this', moment: fields.moment })
		},
		receipts: {
			title: 'Receipts',
			subhead: 'Claim versus reality, line by line.',
			button: 'Check Receipts',
			fieldLabels: { claim: 'Claim', reality: 'Reality' },
			buildInput: (fields) => ({ toolId: 'receipts', claim: fields.claim, reality: fields.reality })
		},
		clapback: {
			title: 'Clapback',
			subhead: 'Bring their line. Leave with yours.',
			button: 'Build Clapback',
			fieldLabels: { comment: 'What they said' },
			buildInput: (fields) => ({ toolId: 'clapback', comment: fields.comment })
		},
		'what-would-meechie-do': {
			title: 'What Would Meechie Do?',
			subhead: 'Give the dilemma and get Meechie\'s move.',
			button: 'Get Meechie Move',
			fieldLabels: { dilemma: 'Dilemma' },
			buildInput: (fields) => ({ toolId: 'wwmd', dilemma: fields.dilemma })
		}
	};

	$: config = modeConfigs[data.mode] ?? randomConfig;
</script>

<svelte:head>
	<title>{config.title} — Meechie's Coloring Book</title>
</svelte:head>

<MeechieModePage {config} />
