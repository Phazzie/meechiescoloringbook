// Purpose: Validate AI-backed MeechieToolAdapter routing and response shaping.
// Why: Ensure every tool reaches the provider with a Meechie system prompt and returns a valid output shape.
// Info flow: Tool input -> mocked provider -> adapter output assertions.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockCreateChatCompletion = vi.fn();

vi.mock('../../src/lib/adapters/provider-adapter.adapter', () => ({
	createProviderAdapter: () => ({
		createChatCompletion: mockCreateChatCompletion,
		createImageGeneration: vi.fn()
	})
}));

// Import after mock registration so the adapter picks up the mocked provider.
const { meechieToolAdapter } = await import('$lib/adapters/meechie-tool-seam');

const okResponse = (headline: string, response: string, rating?: number) => ({
	ok: true as const,
	value: {
		model: 'test-model',
		content: JSON.stringify({ headline, response, ...(rating !== undefined ? { rating } : {}) })
	}
});

beforeEach(() => {
	mockCreateChatCompletion.mockReset();
});

describe('meechieToolAdapter — AI routing', () => {
	it('sends a Meechie system prompt for red_flag_or_run', async () => {
		mockCreateChatCompletion.mockResolvedValue(okResponse('Run.', 'Fault: them. Consequence: access revoked.'));

		const result = await meechieToolAdapter.respond({
			toolId: 'red_flag_or_run',
			situation: 'He said he is not ready for a relationship but keeps texting me every night.'
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.toolId).toBe('red_flag_or_run');
			expect(result.value.headline).toBe('Run.');
			expect(result.value.response).toBe('Fault: them. Consequence: access revoked.');
		}

		const call = mockCreateChatCompletion.mock.calls[0][0];
		expect(call.messages[0].role).toBe('system');
		expect(call.messages[0].content).toContain('You are Meechie');
		expect(call.messages[1].content).toContain('Red Flag or Run');
		expect(call.messages[1].content).toContain('He said he is not ready');
	});

	it('sends a Meechie system prompt for wwmd', async () => {
		mockCreateChatCompletion.mockResolvedValue(
			okResponse('Meechie Move', 'Fault: them. Consequence: silence served back. Move: upgrade your weekend.')
		);

		const result = await meechieToolAdapter.respond({ toolId: 'wwmd', dilemma: 'He left me on read again' });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.toolId).toBe('wwmd');
			expect(result.value.headline).toBeDefined();
			expect(result.value.response).toBeDefined();
		}

		const call = mockCreateChatCompletion.mock.calls[0][0];
		expect(call.messages[0].content).toContain('You are Meechie');
		expect(call.messages[1].content).toContain('What Would Meechie Do');
	});

	it('sends a Meechie system prompt for apology_translator', async () => {
		mockCreateChatCompletion.mockResolvedValue(
			okResponse('What That Really Meant', 'Translation: you centered optics not impact. Meechie logic: name the act.')
		);

		const result = await meechieToolAdapter.respond({
			toolId: 'apology_translator',
			apology: "I'm sorry you feel that way"
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.toolId).toBe('apology_translator');
		}

		const call = mockCreateChatCompletion.mock.calls[0][0];
		expect(call.messages[1].content).toContain('Apology Translator');
		expect(call.messages[1].content).toContain("I'm sorry you feel that way");
	});

	it('sends a Meechie system prompt for rate_excuse with a rating', async () => {
		mockCreateChatCompletion.mockResolvedValue(okResponse('2/10', 'Phones die. Your character did not have to go with it.', 2));

		const result = await meechieToolAdapter.respond({
			toolId: 'rate_excuse',
			excuse: 'My phone died and I left you on read.'
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.toolId).toBe('rate_excuse');
			expect(result.value.rating).toBe(2);
		}

		const call = mockCreateChatCompletion.mock.calls[0][0];
		expect(call.messages[1].content).toContain('Rate This Excuse');
		expect(call.messages[1].content).toContain('My phone died');
	});

	it('sends a Meechie system prompt for caption_this', async () => {
		mockCreateChatCompletion.mockResolvedValue(okResponse('Caption Locked', 'Airport fit check — pretty, paid, and present.'));

		const result = await meechieToolAdapter.respond({ toolId: 'caption_this', moment: 'airport fit check' });

		expect(result.ok).toBe(true);
		const call = mockCreateChatCompletion.mock.calls[0][0];
		expect(call.messages[1].content).toContain('Caption This');
		expect(call.messages[1].content).toContain('airport fit check');
	});

	it('sends a Meechie system prompt for clapback', async () => {
		mockCreateChatCompletion.mockResolvedValue(okResponse('Return Fire', 'Keep watching from the cheap seats.'));

		const result = await meechieToolAdapter.respond({ toolId: 'clapback', comment: 'she thinks she all that' });

		expect(result.ok).toBe(true);
		const call = mockCreateChatCompletion.mock.calls[0][0];
		expect(call.messages[1].content).toContain('Clapback');
	});

	it('sends a Meechie system prompt for receipts', async () => {
		mockCreateChatCompletion.mockResolvedValue(okResponse('Paper Trail', 'He said work. Location said VIP. The receipt is submitted.'));

		const result = await meechieToolAdapter.respond({
			toolId: 'receipts',
			claim: 'I was working late',
			reality: 'location shows VIP section'
		});

		expect(result.ok).toBe(true);
		const call = mockCreateChatCompletion.mock.calls[0][0];
		expect(call.messages[1].content).toContain('Receipts');
		expect(call.messages[1].content).toContain('I was working late');
		expect(call.messages[1].content).toContain('location shows VIP section');
	});

	it('sends a Meechie system prompt for meechie_explains', async () => {
		mockCreateChatCompletion.mockResolvedValue(
			okResponse('Street Glossary', 'A situationship is him renting access with no contract and no deposit.')
		);

		const result = await meechieToolAdapter.respond({ toolId: 'meechie_explains', term: 'situationship' });

		expect(result.ok).toBe(true);
		const call = mockCreateChatCompletion.mock.calls[0][0];
		expect(call.messages[1].content).toContain('Meechie Explains');
		expect(call.messages[1].content).toContain('situationship');
	});

	it('sends a Meechie system prompt for random_meechie', async () => {
		mockCreateChatCompletion.mockResolvedValue(
			okResponse('Random Meechie', 'Keep playing and your cousin is getting a Bundt cake and a front row seat.')
		);

		const result = await meechieToolAdapter.respond({ toolId: 'random_meechie' });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.toolId).toBe('random_meechie');
			expect(result.value.response).toBeTruthy();
		}

		const call = mockCreateChatCompletion.mock.calls[0][0];
		expect(call.messages[1].content).toContain('Random Meechie');
	});

	it('sends a Meechie system prompt for lineup', async () => {
		mockCreateChatCompletion.mockResolvedValue(
			okResponse('Ranked and Ruled', '1st place: "Him" — at least he showed up. 2nd place: "The excuse" — arrived late and underdressed.')
		);

		const result = await meechieToolAdapter.respond({
			toolId: 'lineup',
			prompt: 'Rate these excuses',
			items: ['Him', 'The excuse']
		});

		expect(result.ok).toBe(true);
		const call = mockCreateChatCompletion.mock.calls[0][0];
		expect(call.messages[1].content).toContain('Lineup');
		expect(call.messages[1].content).toContain('Him');
	});

	it('sends a Meechie system prompt for horoscope', async () => {
		mockCreateChatCompletion.mockResolvedValue(
			okResponse('Meechie Forecast — Scorpio', 'You already clocked the lie. The question is what you do with the receipt.')
		);

		const result = await meechieToolAdapter.respond({ toolId: 'horoscope', sign: 'Scorpio' });

		expect(result.ok).toBe(true);
		const call = mockCreateChatCompletion.mock.calls[0][0];
		expect(call.messages[1].content).toContain('Horoscope');
		expect(call.messages[1].content).toContain('Scorpio');
	});

	it('returns PROVIDER_API_KEY_MISSING error when provider has no key', async () => {
		mockCreateChatCompletion.mockResolvedValue({
			ok: false,
			error: { code: 'PROVIDER_API_KEY_MISSING', message: 'XAI_API_KEY is required.' }
		});

		const result = await meechieToolAdapter.respond({ toolId: 'random_meechie' });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('PROVIDER_API_KEY_MISSING');
		}
	});

	it('returns MEECHIE_TOOL_PROVIDER_ERROR on provider failure', async () => {
		mockCreateChatCompletion.mockResolvedValue({
			ok: false,
			error: { code: 'PROVIDER_HTTP_ERROR', message: 'Bad gateway.' }
		});

		const result = await meechieToolAdapter.respond({ toolId: 'random_meechie' });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('MEECHIE_TOOL_PROVIDER_ERROR');
		}
	});

	it('returns MEECHIE_TOOL_PROVIDER_INVALID when response is not valid JSON', async () => {
		mockCreateChatCompletion.mockResolvedValue({
			ok: true,
			value: { model: 'test-model', content: 'not json at all' }
		});

		const result = await meechieToolAdapter.respond({ toolId: 'random_meechie' });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('MEECHIE_TOOL_PROVIDER_INVALID');
		}
	});
});
