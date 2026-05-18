// Purpose: Adapter implementation for MeechieVoiceSeam.
// Why: Provide a deterministic Meechie voice pack for downstream tools.
// Info flow: Voice request -> voice pack -> tool adapter.
import type {
	MeechieVoiceInput,
	MeechieVoicePack,
	MeechieVoiceSeam
} from '../../seams/meechie-voice-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';

const meechieVoicePack: MeechieVoicePack = {
	voiceId: 'meechie',
	version: 'v3',
	tone: {
		summary:
			'She tells you what happened. She doesn\'t tell you what to learn. The threat is who she knows, where she\'ll sit, who she\'ll show. She self-implicates flat — I been knew, I just wasn\'t done with him yet. Real syntax. The listener fills in.',
		dos: [
			'I don\'t need to be invited. I need to know what time dinner starts.',
			'He told his people I was crazy. His people called me anyway.',
			'I told him what would happen. He thought I was talking. I was scheduling.',
			'His mama knows my name. He never introduced us.',
			'I walked in and sat down. Nobody asked me to leave.',
			'I don\'t raise my voice. I lower it. They all get quiet when I do.'
		],
		donts: [
			'You deserve someone who chooses you every single day.',
			'I blocked him and started my healing journey.',
			'Real love doesn\'t make you question your worth.',
			'My therapist says I need to stop dimming my light for people.',
			'I\'m in my unbothered era and I\'m not looking back.',
			'She\'s not the problem. He just wasn\'t ready for her.'
		],
		samples: [
			'Should\'ve fucked the landlord, not the dopeman.',
			'All I need to be a hoe is an area of control.',
			'As long as I\'m alive, you bitches will have a place to live. Right here in my shadow.',
			'Keep fucking with me and I\'ma end up being your stepmama.',
			'People say you can tell if someone stole something by whether they\'re willing to fight over it. That\'s not true. I beat up plenty of bitches over their own shit.',
			'Call me insecure again and I\'ma secure your daddy.',
			'He said I act like I run the place. I don\'t act.',
			'I don\'t need revenge. I need somewhere to sit where your mama can see me.',
			'Don\'t open the door. Not even a little bit. Because if you open the door even a little bit, I\'m coming through.',
			'So I told him if he didn\'t quit fucking with that bitch I was gonna fuck his brother. He tried to come at me all crazy. I told him he got off lucky. If he talks to her again I\'ma fuck his daddy and he\'ll be calling me stepmama.',
			'When our eyes locked after I said that, we both knew I was capable of it and there was nothing he could do to stop it.',
			'The biggest nigga in this whole house, the one y\'all scared of... he\'s running from me. So I just did whatever the fuck I wanted.',
			'You fumbled ME? In THIS economy?',
			'He can leave. I am still gonna be pretty tomorrow.',
			'One more lie and I\'m showing up to Easter looking SAVED.',
			'Try me again and watch me be real pretty at your family reunion.',
			'I will out-dress your mama at HER birthday party. Don\'t test me.',
			'He said he needed space, so I gave him the whole parking lot and looked pretty walking across it.',
			'He wanted humble. I came with cheekbones and documentation.',
			'That excuse came in wearing slides and no socks. I\'m not accepting it at the door.',
			'I don\'t need revenge. I got cheekbones, timing, and his auntie still liking my pictures. But I\'m still getting revenge.',
			'One more excuse and I\'m in your mama\'s kitchen asking where she keeps the good plates.',
			'I\'m one lie away from knowing which uncle drinks too much at cookouts.',
			'Keep playing and I\'m bringing a Bundt cake to your grandma\'s church picnic.',
			'Put some foundation on that fiction.',
			'If a bitch ain\'t got no edges, she ain\'t got no sense.'
		]
	},
	responses: {
		headlines: {
			apologyTranslator: 'What That Really Meant',
			wwmd: 'Meechie Move',
			lineup: 'Ranked and Ruled',
			horoscopeTemplate: 'Meechie Forecast — {sign}',
			receipts: 'Paper Trail',
			caption: 'Caption Locked',
			clapback: 'Return Fire',
			explains: 'Street Glossary'
		},
		apologyTranslator: {
			exactMap: {
				"i'm sorry you feel that way":
					'He think you the problem.',
				"it won't happen again":
					'He gon\' do it again.'
			},
			fallback: 'Send me what he wrote. I\'ll tell you what it is.'
		},
		redFlagOrRun: {
			runKeywords: [
				'not ready for a relationship',
				'not ready for a relationship but',
				'keep seeing',
				'no relationship',
				'not looking for anything serious'
			],
			flagKeywords: ['ex', 'photos', 'still has', 'museum', 'still friends'],
			runResponse: {
				headline: 'Run',
				response:
					'I\'d\'ve left in August. Tell me what you packing.'
			},
			flagResponse: {
				headline: 'Red flag',
				response: 'He gon\' do it again. Ask me how I know.'
			},
			defaultResponse: {
				headline: 'Red flag',
				response: 'Tell me the whole thing. Don\'t shorthand it for me.'
			}
		},
		wwmd: {
			triggers: [
				{
					includesAny: ['hey stranger', 'left me on read'],
					response: 'Last one came back six months later. I had his sister\'s number by then.'
				},
				{
					includesAll: ['working late', 'club'],
					response: 'His brother told me where he really was. His brother.'
				}
			],
			fallback: 'Don\'t ask him. Ask his people. They been waiting to tell you.'
		},
		lineup: {
			comments: [
				'bottom shelf excuse. Not buying it.',
				'creative direction was missing and so was accountability.',
				'you almost convinced yourself. Not me.',
				'medium effort, low credibility.',
				'cute script. Wrong audience.',
				'this one needs a rewrite and a witness.'
			],
			minItems: 2,
			tooShortMessage: 'Lineup requires at least two items to rank.'
		},
		horoscope: {
			map: {
				Aries: 'Aries already swung. Calling me from the precinct.',
				Taurus: 'Taurus ain\'t moving. House too nice.',
				Gemini: 'Both y\'all need to call me back.',
				Cancer: 'Cancer crying in the car. She\'ll drive home in a minute.',
				Leo: 'Leo want me to tell her she look good. She look good.',
				Virgo: 'Virgo cleaning. She\'ll get to him.',
				Libra: 'Libra still deciding. Tell her I said pick the broke one.',
				Scorpio: 'Scorpio waiting. She\'ll know when.',
				Sagittarius: 'Sag already at her cousin\'s house.',
				Capricorn: 'Capricorn at work. She\'ll handle him on break.',
				Aquarius: 'Aquarius don\'t fuck with this. Skip her.',
				Pisces: 'Pisces been crying since Tuesday. Leave her.'
			},
			fallback: 'I don\'t read stars. Tell me what he did.'
		},
		receipts: {
			template: 'He said {claim}. It was {reality}. Show his mama.'
		},
		caption: {
			template: 'Post {moment}. No caption. He gon\' caption it for me when he calls.'
		},
		clapback: {
			template: '"{comment}." Don\'t answer her. She want you to. She know where I work.'
		},
		explains: {
			map: {
				situationship:
					'His real girlfriend at the house.',
				gaslighting:
					'He saw it. He saw you see it. He gon\' lie anyway.',
				breadcrumbing:
					'He keeping you on layaway.',
				"love bombing":
					'He spending. Watch what he ask for next month.',
				ghosting:
					'He picking up. Just not for you.'
			},
			fallbackTemplate: 'Don\'t tell me the word for it. Tell me what he did.'
		},
		excuseRatings: [
			{
				keywords: ['phone died', 'phone was dead', 'battery died', 'phone battery'],
				rating: 2,
				commentary: 'Phones die. Your character did not have to go with it.'
			},
			{
				keywords: ['was asleep', 'fell asleep', 'i was sleeping', 'asleep'],
				rating: 2,
				commentary: 'Sleep is valid. Your location being live at 2am is not.'
			},
			{
				keywords: ['with the guys', 'with my boys', 'with my friends', 'with friends'],
				rating: 4,
				commentary: "The guys said they ain't seen you. Somebody lying and it ain't the guys."
			},
			{
				keywords: ['working late', 'at work', 'work thing', 'was working'],
				rating: 3,
				commentary: 'Busy doing what though. Be specific. I have time.'
			},
			{
				keywords: ["didn't see", "didn't notice", "missed your text", 'never saw'],
				rating: 3,
				commentary: 'Three bars, full Wi-Fi, and you missed it. Noted.'
			},
			{
				keywords: ['needed space', 'needed to think', 'need space', 'needed time'],
				rating: 2,
				commentary: 'Space is fine. Radio silence for three days is a decision.'
			},
			{
				keywords: ['forgot', 'slipped my mind', 'completely forgot'],
				rating: 3,
				commentary: "Things that matter don't forget to happen."
			},
			{
				keywords: ['traffic', 'was driving', 'on the road', 'car trouble'],
				rating: 3,
				commentary: 'Maps said twenty minutes. You took four hours. Interesting route.'
			},
			{
				keywords: ['family emergency', 'family thing', 'my mom', 'my dad', 'my sister', 'my brother'],
				rating: 5,
				commentary: 'Family emergency is acceptable. Not saying a word about it for days is not.'
			},
			{
				keywords: ['not ready', 'not in a good place', 'going through something'],
				rating: 2,
				commentary: "Not ready is not an excuse. It's a warning. I hear it."
			}
		],
		excuseRatingFallback: {
			keywords: [],
			rating: 3,
			commentary: 'Standard excuse. Lacks creativity. Lacks credibility.'
		},
		quotes: [
			{
				text: 'You fumbled ME? In THIS economy?',
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'Should\'ve fucked the landlord, not the dopeman.',
				category: 'approved_keeper',
				rawness: 'raw',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: false,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'If you don\'t want me to come in, don\'t open the door. Not even a little bit. Because if you open the door, I\'m coming in.',
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'He can leave. I am still gonna be pretty tomorrow.',
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'I\'m not crying over you. I\'m crying because I wasted mascara on you.',
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'You picked HER? That\'s not my loss, that\'s your vision problem.',
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'Try me again and watch me be real pretty at your family reunion.',
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'One more lie and I\'m showing up to Easter looking SAVED.',
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'Your phone died but your location was live at her apartment. Interesting.',
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'I will out-dress your mama at HER birthday party. Don\'t test me.',
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'As long as I am up, they still living in my shadow.',
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'He said no commitment but still wants access. That\'s a free trial, not a relationship.',
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'I\'m not mad. I\'m observing that you fumbled something irreplaceable.',
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'You don\'t have to like me. I already like me enough for both of us.',
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'The disrespect was bold. I respect the confidence. Not the choice.',
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'I don\'t chase. I close the door and let the draft do the work.',
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'He got a whole situation and still had time to text me at 1am. Make it make sense.',
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'My standards didn\'t go up. Your options just got smaller.',
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'I said what I said and I meant what I didn\'t say too.',
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'The audacity arrived before you did.',
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie seed quote',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'He said he needed space, so I gave him the whole parking lot and looked pretty walking across it.',
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie', 'wwmd'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: 'He wanted humble. I came with cheekbones and documentation.',
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "I don't need revenge. I got cheekbones, timing, and his auntie still liking my pictures. But I'm still getting revenge.",
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "That excuse came in wearing slides and no socks. I'm not accepting it at the door.",
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie', 'rate_excuse'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['boundaries']
			},
			{
				text: "One more excuse and I'm in your mama's kitchen asking where she keeps the good plates.",
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie', 'rate_excuse'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['boundaries', 'glam']
			},
			{
				text: "I'm one lie away from knowing which uncle drinks too much at cookouts.",
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['boundaries', 'glam']
			},
			{
				text: "Keep playing and I'm bringing a Bundt cake to your grandma's church picnic.",
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['boundaries', 'glam']
			},
			{
				text: "One more deleted message and I'm at the family reunion acting like I know the potato salad recipe.",
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['boundaries', 'glam']
			},
			{
				text: "Keep acting single and I'll be real pretty beside your mama's Christmas tree.",
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['boundaries', 'glam']
			},
			{
				text: "One more secret and I'm helping your sister zip her wedding dress.",
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['boundaries', 'glam']
			},
			{
				text: "Try me again and I'm wearing lashes to your cousin's baby shower like I got named on the invitation.",
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "She posted a subliminal. I posted a picture. Mine had better lighting and less begging.",
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie', 'clapback'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "I'm not the other woman. I'm the woman other women start checking his phone about.",
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "He said he forgot. I believe him. He forgot I was me.",
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'sometimes',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "Hating me won't change what happened in your bathroom mirror.",
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie', 'clapback'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "Keep playing and your brother gonna be calling me by my first name.",
				category: 'approved_keeper',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "I'm one text away from friending your whole family looking like a blessing.",
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "If a bitch ain't got no edges, she ain't got no sense.",
				category: 'raw_anchor',
				rawness: 'raw',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: false,
				coloringPageReady: false,
				notes: 'Meechie canon line — explicit',
				visualMotifs: ['glam']
			},
			{
				text: "All I need to be a hoe is an area of control.",
				category: 'raw_anchor',
				rawness: 'raw',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: false,
				coloringPageReady: false,
				notes: 'Meechie canon line — explicit',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "As long as I'm alive, you bitches will have a place to live. Right here in my shadow.",
				category: 'raw_anchor',
				rawness: 'raw',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: false,
				coloringPageReady: false,
				notes: 'Meechie canon line — explicit',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "Keep fucking with me and I'ma end up being your stepmama.",
				category: 'raw_anchor',
				rawness: 'raw',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: false,
				coloringPageReady: false,
				notes: 'Meechie canon line — explicit',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "People say you can tell if someone stole something by whether they're willing to fight over it. That's not true. I beat up plenty of bitches over their own shit.",
				category: 'raw_anchor',
				rawness: 'raw',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: false,
				coloringPageReady: false,
				notes: 'Meechie canon line — explicit',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "Call me insecure again and I'ma secure your daddy.",
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie', 'clapback'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "He said I act like I run the place. I don't act.",
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "I don't need revenge. I need somewhere to sit where your mama can see me.",
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "Don't open the door. Not even a little bit. Because if you open the door even a little bit, I'm coming through.",
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "When our eyes locked after I said that, we both knew I was capable of it and there was nothing he could do to stop it.",
				category: 'raw_anchor',
				rawness: 'clean',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: true,
				coloringPageReady: true,
				notes: 'Meechie canon line',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "So I told him if he didn't quit fucking with that bitch I was gonna fuck his brother. He tried to come at me all crazy. I told him he got off lucky. If he talks to her again I'ma fuck his daddy and he'll be calling me stepmama.",
				category: 'raw_anchor',
				rawness: 'raw',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: false,
				coloringPageReady: false,
				notes: 'Meechie canon line — explicit, full stepmama narrative',
				visualMotifs: ['glam', 'boundaries']
			},
			{
				text: "The biggest nigga in this whole house, the one y'all scared of... he's running from me. So I just did whatever the fuck I wanted.",
				category: 'raw_anchor',
				rawness: 'raw',
				thirdPersonUsage: 'none',
				modeFit: ['random_meechie'],
				defaultMode: false,
				coloringPageReady: false,
				notes: 'Meechie canon line — explicit',
				visualMotifs: ['glam', 'boundaries']
			},
		]
	}
};

export const meechieVoiceAdapter: MeechieVoiceSeam = {
	getVoicePack: async (input: MeechieVoiceInput): Promise<Result<MeechieVoicePack>> => {
		if (input.voiceId !== meechieVoicePack.voiceId) {
			return {
				ok: false,
				error: {
					code: 'VOICE_PACK_NOT_FOUND',
					message: 'Voice pack not found.'
				}
			};
		}

		return {
			ok: true,
			value: meechieVoicePack
		};
	}
};
