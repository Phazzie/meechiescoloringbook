// Purpose: Contract tests for RateLimitSeam.
// Why: Enforce mock adherence to the seam contract.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import {
  baseCheckInputFixture,
  invalidRateLimitResultFixture,
  otherKeyCheckInputFixture
} from './fixtures';
import { createMockRateLimitSeam } from './mock';
import { validateRateLimitResult } from './validators';

describe('RateLimitSeam mock contract', () => {
  it('allows requests under the limit and decrements remaining', () => {
    const seam = createMockRateLimitSeam();

    const first = seam.check({ ...baseCheckInputFixture, now: 0 });
    expect(first).toEqual({ allowed: true, remaining: 2 });
    expect(validateRateLimitResult(first)).toEqual(first);

    const second = seam.check({ ...baseCheckInputFixture, now: 1_000 });
    expect(second).toEqual({ allowed: true, remaining: 1 });

    const third = seam.check({ ...baseCheckInputFixture, now: 2_000 });
    expect(third).toEqual({ allowed: true, remaining: 0 });
  });

  it('denies the request once the limit is exceeded within the window', () => {
    const seam = createMockRateLimitSeam();
    seam.check({ ...baseCheckInputFixture, now: 0 });
    seam.check({ ...baseCheckInputFixture, now: 1_000 });
    seam.check({ ...baseCheckInputFixture, now: 2_000 });

    const fourth = seam.check({ ...baseCheckInputFixture, now: 3_000 });
    expect(fourth.allowed).toBe(false);
    expect(validateRateLimitResult(fourth)).toEqual(fourth);
    if (!fourth.allowed) {
      expect(fourth.retryAfterMs).toBe(baseCheckInputFixture.windowMs - 3_000);
    }
  });

  it('allows requests again once the window fully elapses', () => {
    const seam = createMockRateLimitSeam();
    seam.check({ ...baseCheckInputFixture, now: 0 });
    seam.check({ ...baseCheckInputFixture, now: 1_000 });
    seam.check({ ...baseCheckInputFixture, now: 2_000 });

    const afterWindow = seam.check({
      ...baseCheckInputFixture,
      now: baseCheckInputFixture.windowMs + 2_001
    });
    expect(afterWindow).toEqual({ allowed: true, remaining: 2 });
  });

  it('isolates request counts per key', () => {
    const seam = createMockRateLimitSeam();
    seam.check({ ...baseCheckInputFixture, now: 0 });
    seam.check({ ...baseCheckInputFixture, now: 1_000 });
    seam.check({ ...baseCheckInputFixture, now: 2_000 });

    const otherKey = seam.check({ ...otherKeyCheckInputFixture, now: 3_000 });
    expect(otherKey).toEqual({ allowed: true, remaining: 2 });
  });

  it('isolates state between separate seam instances', () => {
    const seamA = createMockRateLimitSeam();
    const seamB = createMockRateLimitSeam();
    seamA.check({ ...baseCheckInputFixture, now: 0 });
    seamA.check({ ...baseCheckInputFixture, now: 1_000 });
    seamA.check({ ...baseCheckInputFixture, now: 2_000 });

    const fromB = seamB.check({ ...baseCheckInputFixture, now: 3_000 });
    expect(fromB).toEqual({ allowed: true, remaining: 2 });
  });

  it('rejects an invalid result shape against the validator', () => {
    expect(() => validateRateLimitResult(invalidRateLimitResultFixture)).toThrow();
  });

  it('prunes expired keys without breaking unrelated active keys', () => {
    const seam = createMockRateLimitSeam();

    for (let i = 0; i < 50; i++) {
      seam.check({ ...baseCheckInputFixture, key: `generate:198.51.100.${i}`, now: 0 });
    }

    const afterCleanupInterval = seam.check({
      ...baseCheckInputFixture,
      now: baseCheckInputFixture.windowMs + 60_001
    });
    expect(afterCleanupInterval).toEqual({ allowed: true, remaining: 2 });
  });
});
