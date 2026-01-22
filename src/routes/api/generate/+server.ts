import { json } from '@sveltejs/kit';
import { runGenerationWorkflow } from '$lib/core/generation-workflow';
import { makeServerDependencies } from '$lib/composition/deps.server';
import { validatePromptCompilerInput } from '$lib/seams/prompt-compiler-seam/validators';

export const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const input = validatePromptCompilerInput(body);
    const deps = makeServerDependencies();
    const result = await runGenerationWorkflow(input, deps);
    const history = await deps.galleryStoreSeam.listRecent(5);

    return json({ result, history });
  } catch (error) {
    return json(
      {
        error: 'Invalid request payload.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
};
