// Purpose: Deterministic scoring of Meechie quote quality with explicit pass/fail reasons.
// Why: Keep quote curation auditable and enforceable without model or runtime randomness.
// Info flow: quote text -> 10 weighted checks + penalties -> machine-readable score/band/reasons.

export type MeechieQuoteScoreBand = 'Approved' | 'Revise' | 'Rewrite' | 'Reject';

export type MeechieQuoteSubscore = {
	key:
		| 'voice_punch'
		| 'specificity'
		| 'consequence'
		| 'agency'
		| 'freshness'
		| 'cadence'
		| 'clarity'
		| 'boundary'
		| 'wit'
		| 'non_generic';
	max: number;
	score: number;
	reason: string;
};

export type MeechieQuotePenalty = {
	key:
		| 'banned_phrase'
		| 'therapy_vagueness'
		| 'missing_concrete_anchor'
		| 'forced_third_person'
		| 'generic_empowerment_drift';
	points: number;
	reason: string;
};

export type MeechieQuoteScoreDetails = {
	quote: string;
	totalBeforePenalties: number;
	totalPenalty: number;
	totalScore: number;
	band: MeechieQuoteScoreBand;
	subscores: MeechieQuoteSubscore[];
	penalties: MeechieQuotePenalty[];
	reasons: string[];
};

const bannedPhrases = ['live laugh love', 'good vibes only', 'know your worth'];
const genericEmpowermentPhrases = ['you got this', 'be yourself', 'stay strong', 'keep going'];
const concreteRoleWords = ['landlord', 'mama', 'phone', 'location', 'club', 'apartment', 'birthday', 'easter'];
const consequenceWords = ['or', 'unless', 'watch', 'then', 'consequence', 'lose', 'locked'];
const therapyVagueWords = ['healing', 'journey', 'energy', 'alignment', 'growth'];

const normalize = (value: string): string => value.trim().toLowerCase();

const hasAny = (text: string, words: string[]): boolean => words.some((w) => text.includes(w));

const withBound = (score: number, max: number): number => Math.max(0, Math.min(max, score));

export const scoreMeechieQuote = (quote: string): MeechieQuoteScoreDetails => {
	const text = normalize(quote);
	const words = text.split(/\s+/).filter(Boolean);
	const hasConcrete = hasAny(text, concreteRoleWords);
	const hasConsequence = hasAny(text, consequenceWords);
	const hasThirdPersonLead = /^\s*(he|she|they)\s/.test(text);
	const hasI = /\bi\b/.test(text);
	const hasYou = /\byou\b/.test(text);

	const subscores: MeechieQuoteSubscore[] = [
		{ key: 'voice_punch', max: 10, score: withBound((/[!?]/.test(text) ? 6 : 3) + (text.includes('not') ? 4 : 2), 10), reason: 'Punch from punctuation and contrast words.' },
		{ key: 'specificity', max: 10, score: hasConcrete ? 10 : 3, reason: hasConcrete ? 'Concrete role/place/object found.' : 'Lacks concrete role/place/object.' },
		{ key: 'consequence', max: 10, score: hasConsequence ? 10 : 2, reason: hasConsequence ? 'Names a consequence or condition.' : 'No explicit consequence named.' },
		{ key: 'agency', max: 10, score: hasI ? 9 : hasYou ? 6 : 3, reason: 'Measures direct agency language.' },
		{ key: 'freshness', max: 10, score: hasAny(text, bannedPhrases) ? 1 : 9, reason: 'Rewards non-cliche phrasing.' },
		{ key: 'cadence', max: 10, score: words.length >= 8 && words.length <= 24 ? 9 : 5, reason: 'Prefers concise but complete cadence.' },
		{ key: 'clarity', max: 10, score: text.length >= 35 ? 8 : 5, reason: 'Rewards clear complete thought.' },
		{ key: 'boundary', max: 10, score: hasAny(text, ['door', 'boundary', 'access', 'locked', 'leave']) ? 10 : 4, reason: 'Checks boundary-setting language.' },
		{ key: 'wit', max: 10, score: hasAny(text, ['economy', 'cheap seats', 'interesting', 'vision problem']) ? 9 : 6, reason: 'Checks playful sharpness.' },
		{ key: 'non_generic', max: 10, score: hasAny(text, genericEmpowermentPhrases) ? 2 : 10, reason: 'Penalizes generic empowerment drift.' }
	];

	const penalties: MeechieQuotePenalty[] = [];
	if (hasAny(text, bannedPhrases)) penalties.push({ key: 'banned_phrase', points: 25, reason: 'Contains banned cliche phrase.' });
	if (hasAny(text, therapyVagueWords) && !hasConcrete) penalties.push({ key: 'therapy_vagueness', points: 10, reason: 'Uses therapy-vague language without concrete anchor.' });
	if (!(hasConcrete && hasConsequence)) penalties.push({ key: 'missing_concrete_anchor', points: 12, reason: 'Missing concrete noun/role/place/object/consequence combination.' });
	if (hasThirdPersonLead && !hasI) penalties.push({ key: 'forced_third_person', points: 8, reason: 'Starts in detached third person without first-person voice.' });
	if (hasAny(text, genericEmpowermentPhrases)) penalties.push({ key: 'generic_empowerment_drift', points: 18, reason: 'Drifts into generic empowerment language.' });

	const totalBeforePenalties = subscores.reduce((sum, item) => sum + item.score, 0);
	const totalPenalty = penalties.reduce((sum, item) => sum + item.points, 0);
	const totalScore = Math.max(0, totalBeforePenalties - totalPenalty);
	const band: MeechieQuoteScoreBand = totalScore >= 85 ? 'Approved' : totalScore >= 70 ? 'Revise' : totalScore >= 50 ? 'Rewrite' : 'Reject';

	return { quote, totalBeforePenalties, totalPenalty, totalScore, band, subscores, penalties, reasons: [...subscores.map((s) => `${s.key}: ${s.reason}`), ...penalties.map((p) => `${p.key}: ${p.reason}`)] };
};

export const selectBestMeechieQuote = (quotes: string[]): MeechieQuoteScoreDetails => {
	const scored = quotes.map((quote) => scoreMeechieQuote(quote));
	scored.sort((a, b) => b.totalScore - a.totalScore || a.quote.localeCompare(b.quote));
	return scored[0];
};
