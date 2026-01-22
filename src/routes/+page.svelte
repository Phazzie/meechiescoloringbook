<svelte:head>
  <title>Meechies Coloring Book</title>
</svelte:head>

<script lang="ts">
  type GenerationResponse = {
    result?: {
      ok: boolean;
      data?: {
        images: { id: string; url?: string; b64?: string }[];
        compiled: { imagePrompt: string; negativePrompt: string };
      };
      error?: { stage: string; details: { message?: string } | string };
    };
    history?: Array<{
      id: string;
      createdAt: string;
      request: { description: string };
      images: { id: string; url?: string }[];
    }>;
    error?: string;
    details?: string;
  };

  let description = '';
  let glamLevel: 1 | 2 | 3 | 4 | 5 = 3;
  let density: 'simple' | 'medium' | 'busy' = 'medium';
  let lineThickness: 'thin' | 'medium' | 'thick' = 'medium';
  let borderStyle: 'none' | 'simple' | 'glam' = 'simple';
  let addCaption = false;
  let captionText = '';

  let isLoading = false;
  let errorMessage: string | null = null;
  let resultImages: { id: string; url?: string; b64?: string }[] = [];
  let history: GenerationResponse['history'] = [];

  const submit = async () => {
    errorMessage = null;
    isLoading = true;

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          glamLevel,
          density,
          lineThickness,
          borderStyle,
          addCaption,
          captionText: addCaption ? captionText : undefined
        })
      });

      const data = (await response.json()) as GenerationResponse;

      if (!response.ok) {
        errorMessage = data.error ?? 'Failed to generate images.';
      } else if (data.result?.ok) {
        resultImages = data.result.data?.images ?? [];
        history = data.history ?? [];
      } else {
        errorMessage =
          data.result?.error?.details && typeof data.result.error.details === 'object'
            ? data.result.error.details.message ?? 'Safety policy blocked this request.'
            : 'Safety policy blocked this request.';
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unexpected error.';
    } finally {
      isLoading = false;
    }
  };
</script>

<main>
  <h1>Meechies Coloring Book</h1>
  <p>Generate outline-only, glam coloring book pages.</p>

  <form
    on:submit|preventDefault={() => {
      submit();
    }}
  >
    <label>
      Describe your coloring page
      <textarea bind:value={description} rows="3" required></textarea>
    </label>

    <label>
      Glam level: {glamLevel}
      <input type="range" min="1" max="5" step="1" bind:value={glamLevel} />
    </label>

    <label>
      Density
      <select bind:value={density}>
        <option value="simple">Simple</option>
        <option value="medium">Medium</option>
        <option value="busy">Busy</option>
      </select>
    </label>

    <label>
      Line thickness
      <select bind:value={lineThickness}>
        <option value="thin">Thin</option>
        <option value="medium">Medium</option>
        <option value="thick">Thick</option>
      </select>
    </label>

    <label>
      Border style
      <select bind:value={borderStyle}>
        <option value="none">None</option>
        <option value="simple">Simple</option>
        <option value="glam">Glam</option>
      </select>
    </label>

    <label>
      <input type="checkbox" bind:checked={addCaption} />
      Add caption text
    </label>

    {#if addCaption}
      <label>
        Caption text
        <input type="text" bind:value={captionText} />
      </label>
    {/if}

    <button type="submit" disabled={isLoading || !description}>
      {isLoading ? 'Generating...' : 'Generate'}
    </button>
  </form>

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}

  {#if resultImages.length}
    <section>
      <h2>Latest generation</h2>
      <div class="images">
        {#each resultImages as image}
          {#if image.url}
            <img src={image.url} alt="Generated coloring page" />
          {/if}
        {/each}
      </div>
    </section>
  {/if}

  {#if history?.length}
    <section>
      <h2>History</h2>
      <ul>
        {#each history as item}
          <li>
            <strong>{item.request.description}</strong>
            <small>{item.createdAt}</small>
            <div class="images">
              {#each item.images as image}
                {#if image.url}
                  <img src={image.url} alt="Historical coloring page" />
                {/if}
              {/each}
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</main>

<style>
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  textarea,
  input[type='text'],
  select {
    width: 100%;
    padding: 0.5rem;
  }

  .images {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  img {
    max-width: 240px;
    border: 1px solid #ddd;
  }

  .error {
    color: #b00020;
  }
</style>
