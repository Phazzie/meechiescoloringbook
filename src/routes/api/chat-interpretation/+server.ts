/*
Purpose: Server endpoint for ChatInterpretationSeam using xAI chat completions.
Why: Keep API keys server-side while returning structured specs to the client.
Info flow: Client request -> provider adapter -> parsed spec -> response.
*/
import { json } from '@sveltejs/kit';
import { ChatInterpretationInputSchema } from '../../../../contracts/chat-interpretation.contract';
import { specValidationAdapter } from '$lib/adapters/spec-validation.adapter';
import { providerAdapter } from '$lib/adapters/provider-adapter.adapter';
import {
	ColoringPageSpecSchema,
	RawColoringPageSpecSchema
} from '../../../../contracts/spec-validation.contract';
import type { RequestHandler } from './$types';

const CHAT_MODEL = 'grok-4-1-fast-reasoning';

const SYSTEM_PROMPT = `You map user intent to a ColoringPageSpec JSON object. Output ONLY JSON.

Rules:
- Use this exact schema: {"title":string,"items":[{"number":int,"label":string}],"footerItem"?:{"number":int,"label":string},"listMode":"list"|"title_only","alignment":"left"|"center","numberAlignment":"strict"|"loose","listGutter":"tight"|"normal"|"loose","whitespaceScale":0-100,"textSize":"small"|"medium"|"large","fontStyle":"rounded"|"block"|"hand","textStrokeWidth":4-12,"colorMode":"black_and_white_only"|"grayscale"|"color","decorations":"none"|"minimal"|"dense","illustrations":"none"|"simple"|"scene","shading":"none"|"hatch"|"stippling","border":"none"|"plain"|"decorative","borderThickness":2-16,"variations":1-4,"outputFormat":"png"|"pdf","pageSize":"US_Letter"|"A4"}.
- items: 1-20 items, numbers 1-999, labels 1-40 chars.
- Allowed label characters: letters, numbers, spaces, and .,!?'":;-() only.
- If user intent is vague, choose a short title and 2 list items.
- Default values when unspecified: listMode="list", alignment="left", numberAlignment="strict", listGutter="normal", whitespaceScale=50, textSize="small", fontStyle="rounded", textStrokeWidth=6, colorMode="black_and_white_only", decorations="none", illustrations="none", shading="none", border="plain", borderThickness=8, variations=1, outputFormat="pdf", pageSize="US_Letter".
- Output JSON only. No markdown, no prose.`;

const extractJson = (content: string): string | null => {
	const start = content.indexOf('{');
	const end = content.lastIndexOf('}');
	if (start === -1 || end === -1 || end <= start) {
		return null;
	}
	return content.slice(start, end + 1);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const parsedInput = ChatInterpretationInputSchema.safeParse(body);
	if (!parsedInput.success) {
		return json({
			ok: false,
			error: {
				code: 'CHAT_INPUT_INVALID',
				message: 'Chat interpretation input is invalid.'
			}
		});
	}

	const chatResult = await providerAdapter.createChatCompletion({
		model: CHAT_MODEL,
		messages: [
			{ role: 'system', content: SYSTEM_PROMPT },
			{ role: 'user', content: parsedInput.data.message }
		]
	});
	if (!chatResult.ok) {
		return json({
			ok: false,
			error: chatResult.error
		});
	}

	const extracted = extractJson(chatResult.value.content);
	if (!extracted) {
		return json({
			ok: false,
			error: {
				code: 'CHAT_RESPONSE_INVALID',
				message: 'Chat response did not include JSON.'
			}
		});
	}

	let parsedSpec: unknown = null;
	try {
		parsedSpec = JSON.parse(extracted);
	} catch {
		return json({
			ok: false,
			error: {
				code: 'CHAT_RESPONSE_INVALID',
				message: 'Chat response JSON could not be parsed.'
			}
		});
	}

	const rawParse = RawColoringPageSpecSchema.safeParse(parsedSpec);
	if (!rawParse.success) {
		return json({
			ok: false,
			error: {
				code: 'CHAT_SPEC_INVALID',
				message: 'Chat response did not match the expected spec shape.'
			}
		});
	}

	const validation = await specValidationAdapter.validate({ spec: rawParse.data });
	if (!validation.ok) {
		const firstIssue = validation.issues[0];
		return json({
			ok: false,
			error: {
				code: 'CHAT_SPEC_INVALID',
				message: firstIssue ? firstIssue.message : 'Chat spec failed validation.',
				details: {
					issueCount: String(validation.issues.length)
				}
			}
		});
	}

	const strictParse = ColoringPageSpecSchema.safeParse(rawParse.data);
	if (!strictParse.success) {
		return json({
			ok: false,
			error: {
				code: 'CHAT_SPEC_INVALID',
				message: 'Chat response did not satisfy the full spec constraints.'
			}
		});
	}

	return json({
		ok: true,
		value: {
			spec: strictParse.data
		}
	});
};
