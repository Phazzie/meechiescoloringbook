<!--
Purpose: Make the prompt-boundary fix's visual claim traceable instead of asserted.
Why: A review noted the Cipher Gate claimed a rendered label had disappeared with no
     committed request, response, or image to check that claim against.
Info flow: request prompt -> live endpoint -> response summary -> rendered page.
-->
# Prompt boundary: live verification

Unit tests compare prompt strings. They cannot show what a model actually draws, so the
claim that the template stopped rendering its own section labels is backed by a real call.

**Command**

```
curl -sS -X POST https://meechiescoloringbook.vercel.app/api/image-generation \
  -H 'content-type: application/json' -d @request.json
```

**Files**

| File | What it is |
|---|---|
| `prompt-boundary-live-prompt.txt` | The exact canonical prompt sent, assembled by `promptAssemblyAdapter` |
| `prompt-boundary-live-response.json` | Response summary: `ok`, `modelMetadata`, image descriptor, payload size |
| `prompt-boundary-live-page.jpg` | The returned page, decoded from `images[0].data` |

**Input deliberately chosen to be hostile.** The title is `He Said "Go"` — a double quote is
permitted by `ALLOWED_TEXT_REGEX`, so this is the input that broke an earlier draft which
wrapped drawable text in quotes. A footer label, two list items and a dedication are present
so the check also covers content the template requests *after* the text block.

**What the returned page shows**

- Headline `He Said "Go"` with its quote characters rendered as content
- Second line `Say It Again`
- List items `1. Shine` and `2. Grow`
- Dedication `Dedicated to Jade`
- No section label anywhere on the page

The failure this replaces rendered `TYPOGRAPHY:` in bubble letters as the page's second line.
