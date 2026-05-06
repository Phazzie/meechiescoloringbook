// Purpose: Define shared mode configuration types for generic Meechie mode pages.
// Why: Keep route-level mode maps and rendering component aligned without duplicate type declarations.
// Info flow: Route mode map -> ModeConfig -> MeechieModePage rendering + tool payload build.
import type { MeechieToolInput } from '../../../contracts/meechie-tool.contract';

export type ModeFieldId =
	| 'situation'
	| 'excuse'
	| 'apology'
	| 'moment'
	| 'claim'
	| 'reality'
	| 'comment'
	| 'dilemma';

export type ModeConfig = {
	title: string;
	subhead: string;
	button: string;
	fieldLabels: Partial<Record<ModeFieldId, string>>;
	buildInput: (fields: Record<ModeFieldId, string>) => MeechieToolInput;
};
