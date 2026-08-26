// Purpose: Unit tests for pseudonymous rate-limit identity derivation.
// Why: Raw addresses must never become keys, and IPv6 clients must group at the /64 boundary.
// Info flow: address lookup + secret -> identity helper -> stable key assertions.
import { describe, expect, it } from 'vitest';
import {
	normalizeClientAddress,
	resolveRateLimitIdentity
} from '../../src/lib/server/rate-limit-identity';

const IDENTITY_SECRET = 'fixture-identity-secret';

describe('rate-limit identity', () => {
	it('creates a stable pseudonymous IPv4 identity without retaining the address or secret', () => {
		const first = resolveRateLimitIdentity({
			identitySecret: IDENTITY_SECRET,
			getClientAddress: () => '192.0.2.44'
		});
		const second = resolveRateLimitIdentity({
			identitySecret: IDENTITY_SECRET,
			getClientAddress: () => '192.0.2.44'
		});

		expect(first).toEqual(second);
		expect(first.kind).toBe('pseudonymous');
		expect(first.key).toMatch(/^rl:client:[a-f0-9]{64}$/);
		expect(JSON.stringify(first)).not.toMatch(/192\.0\.2\.44|fixture-identity-secret/);
	});

	it('groups equivalent IPv6 addresses within one /64', () => {
		const first = resolveRateLimitIdentity({
			identitySecret: IDENTITY_SECRET,
			getClientAddress: () => '2001:db8:abcd:12::1'
		});
		const second = resolveRateLimitIdentity({
			identitySecret: IDENTITY_SECRET,
			getClientAddress: () => '2001:0db8:abcd:0012:ffff::beef'
		});

		expect(normalizeClientAddress('2001:db8:abcd:12::1')).toBe(
			'2001:db8:abcd:12::/64'
		);
		expect(first.key).toBe(second.key);
	});

	it('keeps different IPv6 /64 networks in different pseudonymous buckets', () => {
		const first = resolveRateLimitIdentity({
			identitySecret: IDENTITY_SECRET,
			getClientAddress: () => '2001:db8:abcd:12::1'
		});
		const second = resolveRateLimitIdentity({
			identitySecret: IDENTITY_SECRET,
			getClientAddress: () => '2001:db8:abcd:13::1'
		});

		expect(first.key).not.toBe(second.key);
	});

	it('uses the one shared fallback bucket when identity is absent, invalid, or lookup throws', () => {
		const absent = resolveRateLimitIdentity({ identitySecret: IDENTITY_SECRET });
		const invalid = resolveRateLimitIdentity({
			identitySecret: IDENTITY_SECRET,
			getClientAddress: () => 'not-an-address'
		});
		const thrown = resolveRateLimitIdentity({
			identitySecret: IDENTITY_SECRET,
			getClientAddress: () => {
				throw new Error('address provider unavailable');
			}
		});

		expect(absent.kind).toBe('fallback');
		expect(absent.key).toBe(invalid.key);
		expect(absent.key).toBe(thrown.key);
		expect(absent.key).toMatch(/^rl:fallback:[a-f0-9]{64}$/);
	});

	it('treats dotted and hexadecimal IPv4-mapped IPv6 forms as the IPv4 identity', () => {
		const ipv4 = resolveRateLimitIdentity({
			identitySecret: IDENTITY_SECRET,
			getClientAddress: () => '192.0.2.44'
		});
		const mappedAddresses = [
			'::ffff:192.0.2.44',
			'::ffff:c000:22c',
			'0:0:0:0:0:ffff:c000:022c',
			'0000:0000:0000:0000:0000:ffff:c000:022c'
		];

		for (const address of mappedAddresses) {
			expect(normalizeClientAddress(address)).toBe('192.0.2.44');
			expect(
				resolveRateLimitIdentity({
					identitySecret: IDENTITY_SECRET,
					getClientAddress: () => address
				}).key
			).toBe(ipv4.key);
		}
	});

	it('keeps distinct hexadecimal IPv4-mapped clients in distinct buckets', () => {
		const first = resolveRateLimitIdentity({
			identitySecret: IDENTITY_SECRET,
			getClientAddress: () => '::ffff:c000:022c'
		});
		const second = resolveRateLimitIdentity({
			identitySecret: IDENTITY_SECRET,
			getClientAddress: () => '::ffff:c000:022d'
		});

		expect(first.key).not.toBe(second.key);
	});

	it('requires an identity secret without echoing rejected values', () => {
		expect(() =>
			resolveRateLimitIdentity({
				identitySecret: '',
				getClientAddress: () => '192.0.2.44'
			})
		).toThrow('Rate limit identity configuration is invalid.');
	});
});
