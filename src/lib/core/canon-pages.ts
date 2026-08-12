import type { MeechieStudioCurrentText } from '../../../contracts/meechie-studio-text.contract';

export type CanonPagePreset = MeechieStudioCurrentText & { id: string };

export const CANON_PAGES: CanonPagePreset[] = [
	{
		id: 'canon-1-shadow',
		verdict: 'Right here in my shadow.',
		quote: "As long as I'm alive, you bitches will have a place to live. Right here in my shadow.",
		pageTitle: 'IN MY SHADOW',
		pageItems: ['The Bitches', 'My Shadow', 'The Lease', 'The Rent'],
		rating: 10
	},
	{
		id: 'canon-2-control',
		verdict: 'An area of control.',
		quote: 'All I need to be a hoe is an area of control.',
		pageTitle: 'AREA OF CONTROL',
		pageItems: ['The Area', 'The Control', 'The Hoe Phase'],
		rating: 8
	},
	{
		id: 'canon-3-landlord',
		verdict: "Should've fucked the landlord.",
		quote: "Should've fucked the landlord, not the dopeman.",
		pageTitle: 'THE LANDLORD',
		pageItems: ['The Landlord', 'The Dopeman', 'The Rent', 'The Mistakes'],
		rating: 9
	},
	{
		id: 'canon-4-stepmama',
		verdict: "I'ma be your stepmama.",
		quote: "Keep fucking with me and I'ma end up being your stepmama.",
		pageTitle: 'YOUR STEPMAMA',
		pageItems: ['Your Daddy', 'The Stepchild', 'The Discipline', 'The Consequence'],
		rating: 10
	},
	{
		id: 'canon-5-stole',
		verdict: 'I beat up plenty of bitches over their own shit.',
		quote: "People say you can tell if someone stole something by whether they're willing to fight over it. That's not true. I beat up plenty of bitches over their own shit.",
		pageTitle: 'THEIR OWN SHIT',
		pageItems: ['The Fight', 'Their Own Shit', 'The Stolen Goods', 'The Audacity'],
		rating: 10
	},
	{
		id: 'canon-6-door',
		verdict: "I'm comin through.",
		quote: "Don't open the door. Not even a little bit. Cause if you open the door even a little bit, I'm comin through.",
		pageTitle: 'COMIN THROUGH',
		pageItems: ['The Door', 'A Little Bit', 'The Entryway', 'The Consequence'],
		rating: 10
	},
	{
		id: 'canon-7-running',
		verdict: "He's running from me.",
		quote: "The biggest nigga in the house... the one y'all scared of? He's running from me.",
		pageTitle: 'RUNNING FROM ME',
		pageItems: ['The Biggest Nigga', 'The House', 'Me', 'The Fear'],
		rating: 10
	}
];
