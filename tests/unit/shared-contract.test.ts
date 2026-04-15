// Purpose: Unit tests for shared contract schemas.
// Why: Ensure foundational schemas (Scenario, SeamError, Result) reject invalid data.
// Info flow: Test inputs -> Zod schemas -> parse success/failure assertions.
import { describe, expect, it } from 'vitest';
import {
	ScenarioSchema,
	NonEmptyStringSchema,
	SeamErrorSchema,
	resultSchema
} from '../../contracts/shared.contract';
import { z } from 'zod';

describe('shared.contract schemas', () => {
	describe('ScenarioSchema', () => {
		it('accepts "sample"', () => {
			expect(ScenarioSchema.parse('sample')).toBe('sample');
		});

		it('accepts "fault"', () => {
			expect(ScenarioSchema.parse('fault')).toBe('fault');
		});

		it('rejects unknown scenario', () => {
			expect(() => ScenarioSchema.parse('unknown')).toThrow();
		});

		it('rejects empty string', () => {
			expect(() => ScenarioSchema.parse('')).toThrow();
		});

		it('rejects non-string types', () => {
			expect(() => ScenarioSchema.parse(42)).toThrow();
			expect(() => ScenarioSchema.parse(null)).toThrow();
		});
	});

	describe('NonEmptyStringSchema', () => {
		it('accepts non-empty string', () => {
			expect(NonEmptyStringSchema.parse('hello')).toBe('hello');
		});

		it('rejects empty string', () => {
			expect(() => NonEmptyStringSchema.parse('')).toThrow();
		});

		it('rejects non-string types', () => {
			expect(() => NonEmptyStringSchema.parse(123)).toThrow();
		});
	});

	describe('SeamErrorSchema', () => {
		it('accepts valid error with code and message', () => {
			const input = { code: 'ERR_TEST', message: 'Something went wrong' };
			const result = SeamErrorSchema.parse(input);
			expect(result.code).toBe('ERR_TEST');
			expect(result.message).toBe('Something went wrong');
		});

		it('accepts error with optional details', () => {
			const input = {
				code: 'ERR_DETAIL',
				message: 'Has details',
				details: { key: 'value' }
			};
			const result = SeamErrorSchema.parse(input);
			expect(result.details).toEqual({ key: 'value' });
		});

		it('accepts error without details', () => {
			const input = { code: 'ERR_NO_DETAIL', message: 'No details' };
			const result = SeamErrorSchema.parse(input);
			expect(result.details).toBeUndefined();
		});

		it('rejects empty code', () => {
			expect(() =>
				SeamErrorSchema.parse({ code: '', message: 'msg' })
			).toThrow();
		});

		it('rejects empty message', () => {
			expect(() =>
				SeamErrorSchema.parse({ code: 'ERR', message: '' })
			).toThrow();
		});

		it('rejects missing code field', () => {
			expect(() =>
				SeamErrorSchema.parse({ message: 'msg' })
			).toThrow();
		});

		it('rejects missing message field', () => {
			expect(() =>
				SeamErrorSchema.parse({ code: 'ERR' })
			).toThrow();
		});
	});

	describe('resultSchema', () => {
		const TestResultSchema = resultSchema(z.string());

		it('accepts ok: true with valid value', () => {
			const result = TestResultSchema.parse({ ok: true, value: 'success' });
			expect(result).toEqual({ ok: true, value: 'success' });
		});

		it('accepts ok: false with valid error', () => {
			const result = TestResultSchema.parse({
				ok: false,
				error: { code: 'ERR', message: 'fail' }
			});
			expect(result).toEqual({
				ok: false,
				error: { code: 'ERR', message: 'fail' }
			});
		});

		it('rejects ok: true with wrong value type', () => {
			expect(() =>
				TestResultSchema.parse({ ok: true, value: 42 })
			).toThrow();
		});

		it('rejects ok: false with invalid error shape', () => {
			expect(() =>
				TestResultSchema.parse({ ok: false, error: { code: '' } })
			).toThrow();
		});

		it('rejects missing ok field', () => {
			expect(() =>
				TestResultSchema.parse({ value: 'test' })
			).toThrow();
		});

		it('works with complex value schemas', () => {
			const ComplexResult = resultSchema(
				z.object({ id: z.number(), name: z.string() })
			);
			const result = ComplexResult.parse({
				ok: true,
				value: { id: 1, name: 'test' }
			});
			expect(result).toEqual({ ok: true, value: { id: 1, name: 'test' } });
		});
	});
});
