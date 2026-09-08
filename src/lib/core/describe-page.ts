// Purpose: Every decision `/describe` makes about a page the reader asked for in their own words —
//          whether a sentence is worth sending, what the interpreted spec actually says, what is
//          worth warning about before a generation is paid for, and one plain sentence for each way
//          the interpretation can fail.
// Why: `ChatInterpretationSeam` has been able to turn "make me a page that says I'm not arguing,
//      I'm explaining why I'm right" into a validated `ColoringPageSpec` since the app's first
//      weeks — contract, mock, fixtures, probe, pipeline, live billable endpoint and a browser-side
//      adapter, all tested. Nothing under `src/routes/**` or `src/lib/components/**` ever called
//      any of it, so the app could not be *told* what to put on a page: the reader picked one of
//      eight fixed modes and filled in a field. This module is the policy half of the front door.
// Info flow: reader's sentence -> `describeMessageProblem` gate -> /api/chat-interpretation ->
//            `ColoringPageSpec` -> `readBackInterpretedPage` -> the reader decides -> /api/generate.
// Invariants:
//   - Pure. No I/O, no clock, no DOM. Every sentence here is a function of a validated spec or of
//     an error the server actually returned.
//   - Nothing here may describe a page that will not be generated. The read-back is derived from
//     the spec that `/api/generate` is about to be handed — the same object, not a copy of the
//     reader's request — so "what Meechie understood" cannot drift from what gets drawn.
//   - A caution is never a refusal. Every one of them describes a page this app will happily make;
//     they exist so the reader spends a generation knowing what they are buying, which is the whole
//     reason the interpretation is shown before the button that pays for a picture.
import type { ColoringPageSpec } from '../../../contracts/spec-validation.contract';
import { MAX_SPEC_ITEMS } from '../../../contracts/spec-validation.contract';
import { MAX_TOOL_PAGE_ITEMS } from './tool-page-recipe';
import {
	CHAT_INTERPRETATION_QUOTA_COST,
	describeAiQuota,
	type AiQuotaSnapshot
} from './ai-quota';

/** The one path this surface lives at. Imported by the nav so a rename cannot leave a dead link. */
export const DESCRIBE_PATH = '/describe';

/** The stem every download from this surface shares, e.g. `meechie-described-<timestamp>.pdf`. */
export const DESCRIBE_FILE_BASE_SLUG = 'described';

/**
 * The longest sentence this surface will send.
 *
 * `ChatInterpretationInputSchema` is `{ message: NonEmptyStringSchema }` — non-empty and otherwise
 * unbounded — so without a cap here a pasted document would be billed as one interpretation and
 * then almost certainly come back as `CHAT_SPEC_INVALID`. The limit is a client policy and not a
 * contract change on purpose: the endpoint's job is to accept what it is given, and this surface's
 * job is to not waste the reader's quota on something it can see will not work. Long enough for a
 * paragraph of real detail; short enough that the model is describing a page rather than a story.
 */
export const DESCRIBE_MESSAGE_MAX_LENGTH = 400;

/**
 * The shortest sentence worth a paid call.
 *
 * "hi" is a non-empty string, so the contract accepts it, charges for it, and returns whatever the
 * model invents. Refusing it locally costs the reader nothing.
 */
export const DESCRIBE_MESSAGE_MIN_LENGTH = 8;

/**
 * Starter sentences, shown as examples rather than pre-filled.
 *
 * Pre-filling is what `mode-catalog.ts` had to undo: a page shipped with invented drama in every
 * field could never fail its required-field check, and the button returned a real verdict about a
 * fiction the reader never wrote. These are clickable suggestions; the field starts empty.
 */
export const DESCRIBE_EXAMPLES: readonly string[] = [
	'A page that says "I am not arguing, I am explaining why I am right" with roses around it',
	'Five things I am not doing again this year, plain border, big letters',
	'A title-only page that just says "Ask me again when you have receipts"',
	'A checklist of what a real apology has in it, US Letter, room to write'
] as const;

/**
 * Why this message cannot be sent, or `''` when it can.
 *
 * A sentence rather than a boolean because the button has to say what is wrong with the field
 * without the reader guessing. Empty input returns `''` too: a field nobody has typed in yet has
 * nothing wrong with it, and captioning it with an error is how a form starts out shouting.
 */
export const describeMessageProblem = (message: string): string => {
	const trimmed = message.trim();
	if (trimmed.length === 0) return '';
	if (trimmed.length < DESCRIBE_MESSAGE_MIN_LENGTH) {
		return 'Tell Meechie a bit more — a few words about what the page should say.';
	}
	if (trimmed.length > DESCRIBE_MESSAGE_MAX_LENGTH) {
		return `That is ${trimmed.length} characters. Keep it under ${DESCRIBE_MESSAGE_MAX_LENGTH} so Meechie is describing a page, not a story.`;
	}
	return '';
};

/** True when this message is worth spending an interpretation on. */
export const canInterpretMessage = (message: string): boolean => {
	const trimmed = message.trim();
	return trimmed.length > 0 && describeMessageProblem(message) === '';
};

/**
 * One sentence for each way an interpretation can fail, in the reader's terms.
 *
 * Keyed on the contract's own error codes rather than on the server's message, because those
 * messages are written for a log ("Chat response did not match the expected spec shape.") and the
 * reader needs to know what to do next. The default deliberately falls back to the server's own
 * message: an unrecognised code means something this surface has not been taught about, and
 * repeating what the server said is more useful than a generic apology that hides it.
 *
 * `RATE_LIMITED` and `RATE_LIMIT_UNAVAILABLE` are here because the guard's refusal body reaches
 * this surface through the same shape as a pipeline error, and the quota line beside the button
 * already says when the bucket refills.
 */
export const interpretFailureSentence = (error: {
	code: string;
	message: string;
}): string => {
	switch (error.code) {
		case 'CHAT_INPUT_INVALID':
			return 'Meechie could not read that. Try describing the page in a sentence or two.';
		case 'CHAT_RESPONSE_INVALID':
		case 'CHAT_OUTPUT_INVALID':
			return 'Meechie answered with something that was not a page. Try again, or say it a different way.';
		case 'CHAT_SPEC_INVALID':
			// The server's message here is the first validation issue, and it names the field that
			// failed — which is the one case where the underlying message genuinely helps.
			return `Meechie built a page that would not pass the checks: ${error.message}`;
		case 'CHAT_ABORTED':
			return 'That request was cancelled before Meechie answered.';
		case 'RATE_LIMITED':
			return "Meechie's desk is full right now. The line under the button says when she is free.";
		case 'RATE_LIMIT_UNAVAILABLE':
			return 'The quota service is unreachable, so nothing can be sent right now. Try again shortly.';
		default:
			return error.message;
	}
};

/**
 * One line of the interpreted page, positioned and numbered exactly as it will be printed.
 *
 * `number` is `null` for the headline's second line, and that is not a cosmetic choice.
 * `ColoringPageSpecSchema` requires a `number` on `footerItem`, but
 * `src/lib/adapters/prompt-assembly-seam/index.ts` L55 and L83-85 use only `footerItem.label`, and
 * it uses it as the **unnumbered second line directly under the headline** — not as a last entry
 * after the list. A read-back that showed it numbered, at the bottom, would have the reader approve
 * a layout the paid generation was never going to draw, which is the one thing this surface exists
 * to prevent.
 */
export type ReadBackLine = {
	/** The printed number, or `null` for a line the prompt renders without one. */
	number: number | null;
	label: string;
	/** True for the headline's second line — first on the sheet, and never numbered. */
	isSecondLine: boolean;
};

/**
 * What Meechie understood, in the reader's language, before a picture is paid for.
 *
 * The whole point of this surface: an interpretation is one billable call, a picture is another, and
 * showing the first before charging for the second is the only way the reader finds out that "five
 * things" became a title-only page *before* they have bought it.
 */
export type InterpretedPageReadback = {
	/** The exact words that will head the page. */
	title: string;
	/** Every line that will print under it, in order. Empty for a title-only page. */
	lines: readonly ReadBackLine[];
	/** Flat statements about the page: paper, border, lettering, what is drawn. */
	facts: readonly string[];
	/** Things worth knowing before spending a generation. Never a refusal — see the invariants. */
	cautions: readonly string[];
	/** How many pictures this will produce, which is also what it charges. */
	pictureCount: number;
};

const PAPER_NAMES: Record<ColoringPageSpec['pageSize'], string> = {
	US_Letter: 'US Letter',
	A4: 'A4'
};

const BORDER_FACTS: Record<ColoringPageSpec['border'], string> = {
	none: 'No border.',
	plain: 'A plain border around the edge.',
	decorative: 'A decorative border around the edge.'
};

const TEXT_SIZE_FACTS: Record<ColoringPageSpec['textSize'], string> = {
	small: 'Small lettering, which leaves the most room to colour.',
	medium: 'Medium lettering.',
	large: 'Large lettering, which fills more of the sheet.'
};

const ILLUSTRATION_FACTS: Record<ColoringPageSpec['illustrations'], string> = {
	none: 'No illustration — the words are the page.',
	simple: 'A simple illustration alongside the words.',
	scene: 'A full drawn scene around the words.'
};

const DECORATION_FACTS: Record<ColoringPageSpec['decorations'], string> = {
	none: '',
	minimal: 'A few decorations.',
	dense: 'Dense decoration across the page.'
};

/**
 * Turn a validated spec into the sentences the reader gets to check.
 *
 * Reads only fields the spec actually carries. Nothing is inferred from the message the reader
 * typed: the model may have ignored half of it, and a read-back built from the request rather than
 * the result would hide exactly the mismatch this exists to expose.
 */
export const readBackInterpretedPage = (
	spec: ColoringPageSpec
): InterpretedPageReadback => {
	// The second line first, because that is where the prompt puts it. See `ReadBackLine`.
	const lines: ReadBackLine[] = spec.footerItem
		? [{ number: null, label: spec.footerItem.label, isSecondLine: true }]
		: [];
	for (const item of spec.items) {
		lines.push({ number: item.number, label: item.label, isSecondLine: false });
	}

	const facts: string[] = [
		`${PAPER_NAMES[spec.pageSize]} paper.`,
		BORDER_FACTS[spec.border],
		TEXT_SIZE_FACTS[spec.textSize],
		ILLUSTRATION_FACTS[spec.illustrations],
		DECORATION_FACTS[spec.decorations]
	].filter((fact) => fact.length > 0);

	const cautions: string[] = [];
	if (spec.listMode === 'title_only') {
		cautions.push(
			'This is a title-only page: the headline and nothing else. If you asked for a list, say so again and try another read-back.'
		);
	}
	if (spec.items.length > MAX_TOOL_PAGE_ITEMS) {
		cautions.push(
			`${spec.items.length} lines is more than the rest of the app will put on one sheet (${MAX_TOOL_PAGE_ITEMS}). It will still print — the lettering just gets small and there is less left to colour.`
		);
	}
	if (spec.colorMode !== 'black_and_white_only') {
		cautions.push(
			'This asks for a page that is already coloured in, not plain outlines. Say "black and white outlines" if you meant a page to colour.'
		);
	}
	if (spec.variations > 1) {
		cautions.push(
			`This makes ${spec.variations} pictures, and costs ${spec.variations} generations rather than one.`
		);
	}

	return {
		title: spec.title,
		lines,
		facts,
		cautions,
		pictureCount: spec.variations
	};
};

/**
 * The one-line summary of an interpretation, for the heading above the read-back.
 *
 * Counts what will actually print, footer included, because that is what the reader is checking
 * against — not `spec.items.length`, which omits it.
 */
export const summariseReadback = (readback: InterpretedPageReadback): string => {
	if (readback.lines.length === 0) {
		return 'A page with just the headline on it.';
	}
	const count = readback.lines.length;
	return `A page with the headline and ${count} line${count === 1 ? '' : 's'} under it.`;
};

/**
 * The quota sentence under this surface's button.
 *
 * Priced and named for *this* action: one read-back is one unit, where a studio rewrite is two, so
 * reusing the studio's arithmetic here would have told the reader they had half the read-backs they
 * actually had. Both sentences come from the same reading of the same bucket; each says what it is
 * counting so the two numbers cannot be read as a contradiction.
 */
export const describeReadbackQuota = (
	snapshot: AiQuotaSnapshot | null,
	formatTime: (date: Date) => string
): string =>
	describeAiQuota(snapshot, formatTime, {
		unitsPerAction: CHAT_INTERPRETATION_QUOTA_COST,
		actionNoun: 'read-back'
	});

/**
 * Reduce the reader's sentence to something that can safely ride in a style hint.
 *
 * Two hard requirements, both enforced by stripping rather than by checking:
 *
 * 1. **No colons.** `PROMPT_FORBIDDEN_TOKENS` is `['size:', 'quality:', 'style:']` and
 *    `RESERVED_STYLE_HINT_HEADINGS` are all headings ending in `:`. Every one of them contains a
 *    colon, so text with no colon cannot contain any of them — a provable invariant rather than a
 *    blocklist that a new token would slip past. A reader who writes "style: gothic" would
 *    otherwise fail their own generation at the assembly seam.
 * 2. **No structural characters.** Newlines and control characters could open what reads as a new
 *    prompt section.
 *
 * Everything outside the allowed set becomes a space rather than vanishing, so "roses/thorns" reads
 * as "roses thorns" and not "rosesthorns", and the result is collapsed and capped.
 */
const SUBJECT_MAX_LENGTH = 160;

export const styleSubjectFromDescription = (description: string): string =>
	description
		.replace(/[^A-Za-z0-9 .,!?'"\-()]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, SUBJECT_MAX_LENGTH)
		.trim();

/**
 * The style guidance sent to `/api/generate` alongside a described spec.
 *
 * Built from the spec's own drawing fields **and** from the sentence the spec was interpreted from.
 * The first draft used the spec alone, on the argument that the sentence is a *page* request and
 * repeating it risks the model drawing those words twice. A review round was right that this loses
 * more than it protects: `ColoringPageSpec` has no field that can hold "roses", so
 * `illustrations: 'simple'` is all that survives of "with roses around it" and the shipped example
 * could not produce the page it advertises. Dropping the one thing the reader actually asked for is
 * the promise-to-delivery gap this whole surface exists to close.
 *
 * The subject therefore rides along, sanitized by `styleSubjectFromDescription` and introduced with
 * an explicit instruction not to letter it — the same shape the prompt template already uses for
 * its own blocks ("render these exact words and nothing else", "Do not draw any section label").
 * **This is the one part of this feature that cannot be validated here:** no `XAI_API_KEY` is
 * available, so whether a live model honours that instruction is untested. It is one pure function
 * and one call site, so reverting to the derived-only hint is a two-line change.
 *
 * Always non-empty: `GenerateRequestSchema` types `styleHint` as an optional *non-empty* string, so
 * a hint that emptied out would have to be omitted rather than sent, and a caller that forgot the
 * difference would fail the contract at the route. A description that sanitizes away to nothing
 * simply leaves the derived hint standing.
 */
export const styleHintForSpec = (
	spec: ColoringPageSpec,
	description = ''
): string => {
	const parts = ['clean black outline coloring book page'];
	if (spec.illustrations === 'scene') parts.push('a full drawn scene around the words');
	else if (spec.illustrations === 'simple') parts.push('one simple drawing beside the words');
	if (spec.decorations === 'dense') parts.push('dense decoration filling the margins');
	else if (spec.decorations === 'minimal') parts.push('a few small decorations');
	if (spec.border === 'decorative') parts.push('an ornate drawn border');
	if (spec.shading === 'hatch') parts.push('hatched shading');
	else if (spec.shading === 'stippling') parts.push('stippled shading');
	const subject = styleSubjectFromDescription(description);
	if (subject.length > 0) {
		parts.push(`draw the subject matter the reader asked for, without lettering any of these words - ${subject}`);
	}
	return parts.join(', ');
};

/**
 * The upper bound the model is told about, restated for the reader beside the field.
 *
 * Exported so the surface cannot print a different number from the one the spec contract enforces:
 * `CHAT_SYSTEM_PROMPT` promises 1-20 items and `ColoringPageSpecSchema` caps them at
 * `MAX_SPEC_ITEMS`. If that cap ever moves, this moves with it.
 */
export const DESCRIBE_MAX_LINES = MAX_SPEC_ITEMS;
