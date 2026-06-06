// Purpose: Keep generated route titles short enough for provider prompt limits.
// Why: Tool responses can be long, while title-only pages only need the strongest printable line.
// Info flow: Tool output text -> compact page title -> prompt assembly.
const MAX_TITLE_LENGTH = 96;
const MIN_WORD_BREAK_POSITION = 40;

const normalizeTitleText = (value: string): string =>
	value
		.normalize('NFKD')
		.replace(/[\u2012-\u2015]/g, '-')
		.replace(/[^\w .,!?'":;\/\-()]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

export const compactColoringPageTitle = (
	parts: string[],
	fallback = 'Meechie Said It'
): string => {
	const normalized = normalizeTitleText(parts.filter(Boolean).join(' - '));
	const safe = normalized.length > 0 ? normalized : fallback;
	if (safe.length <= MAX_TITLE_LENGTH) {
		return safe;
	}

	const sliced = safe.slice(0, MAX_TITLE_LENGTH).trim();
	const lastSpace = sliced.lastIndexOf(' ');
	return (lastSpace > MIN_WORD_BREAK_POSITION ? sliced.slice(0, lastSpace) : sliced)
		.replace(/[.,;:\-]+$/, '')
		.trim();
};
