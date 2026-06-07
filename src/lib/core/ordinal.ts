// Purpose: Provide correct English ordinal suffixes (1st, 2nd, 3rd, 4th, etc.) for display labels.
// Why: Avoid naive formatting errors like '21th' or '22th' in lineup indices.
// Info flow: number -> suffix calculation -> formatted string.

export const formatOrdinal = (n: number): string => {
	const cent = n % 100;
	if (cent >= 11 && cent <= 13) {
		return `${n}th`;
	}
	const dec = n % 10;
	if (dec === 1) return `${n}st`;
	if (dec === 2) return `${n}nd`;
	if (dec === 3) return `${n}rd`;
	return `${n}th`;
};
