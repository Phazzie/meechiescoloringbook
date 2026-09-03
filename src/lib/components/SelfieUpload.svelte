<!--
  Purpose: Handle selfie image upload and base64 conversion for the wig try-on feature.
  Why: Provide a clean file-input interface that emits base64 data ready for the xAI API.
  Info flow: File input -> FileReader -> base64 string + mimeType -> onUpload callback -> parent page.
-->
<script lang="ts">
	import { parseSelfieDataUrl } from '$lib/core/selfie-upload';

	type AllowedMime = 'image/jpeg' | 'image/png' | 'image/webp';

	let { onUpload }: { onUpload: (_base64: string, _mimeType: AllowedMime) => void } = $props();

	let previewUrl = $state('');
	let error = $state('');

	const ALLOWED_TYPES: AllowedMime[] = ['image/jpeg', 'image/png', 'image/webp'];
	const MAX_SIZE_MB = 8;

	const handleFileChange = (e: Event): void => {
		error = '';
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (!ALLOWED_TYPES.includes(file.type as AllowedMime)) {
			error = 'Upload a JPEG, PNG, or WebP photo.';
			return;
		}
		if (file.size > MAX_SIZE_MB * 1024 * 1024) {
			error = `Photo must be under ${MAX_SIZE_MB}MB.`;
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			const parsed = parseSelfieDataUrl(reader.result);
			if (!parsed.ok) {
				error = parsed.error;
				return;
			}
			previewUrl = parsed.dataUrl;
			onUpload(parsed.base64, file.type as AllowedMime);
		};
		reader.onerror = () => {
			error = 'Failed to read file. Please try again.';
		};
		reader.onabort = () => {
			error = 'File read was cancelled.';
		};
		reader.readAsDataURL(file);
		// Reset value so re-selecting the same file fires onchange again
		input.value = '';
	};
</script>

<div class="selfie-upload">
	{#if previewUrl}
		<img src={previewUrl} alt="Your selfie preview" class="selfie-preview" />
	{/if}
	<label class="upload-label" for="selfie-input">
		{previewUrl ? '📷 Change Photo' : '📷 Upload Your Selfie'}
		<input
			id="selfie-input"
			type="file"
			accept="image/jpeg,image/png,image/webp"
			onchange={handleFileChange}
			class="file-input"
		/>
	</label>
	{#if error}
		<p class="upload-error" role="alert">{error}</p>
	{/if}
</div>

<style>
	.selfie-upload {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.65rem;
	}

	.selfie-preview {
		width: 110px;
		height: 110px;
		object-fit: cover;
		border-radius: 50%;
		border: 3px solid #ff1493;
		box-shadow: 0 0 12px rgba(255, 20, 147, 0.3);
		display: block;
	}

	.upload-label {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.58rem 0.82rem;
		border: 1px solid rgba(201, 162, 39, 0.32);
		border-radius: 6px;
		background: rgba(7, 7, 15, 0.58);
		color: var(--gold-bright, #f0c44a);
		font-family: var(--font-label, sans-serif);
		font-weight: 700;
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		cursor: pointer;
		transition: background 0.12s;
	}

	.upload-label:hover {
		background: rgba(201, 162, 39, 0.12);
	}

	/* Visually hidden file input — label acts as the trigger */
	.file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.upload-error {
		margin: 0;
		font-size: 0.82rem;
		color: #ff8ab3;
	}
</style>
