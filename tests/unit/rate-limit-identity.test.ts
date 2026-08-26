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

	it('derives byte-identical normalized addresses and identity keys (golden values)', () => {
		// Locked against refactors: these keys ARE the durable rate-limit bucket names.
		// A single changed byte silently repartitions every existing bucket in production.
		const golden: ReadonlyArray<readonly [string, string | null, string]> = [
			['192.0.2.44', '192.0.2.44', 'rl:client:56a3a23199091c9e65660176753124b8dfa1e0a90fca8534d6ca29c29199c856'],
			['10.0.0.1', '10.0.0.1', 'rl:client:c87ca079831023b773ca1b9627268a25fd56495cbe76a0c1121b072132ce9fae'],
			['255.255.255.255', '255.255.255.255', 'rl:client:f36f0686a54acff04766d7393675cb61e788083a65caf646a6b58f119ce8ea17'],
			['2001:db8:abcd:12::1', '2001:db8:abcd:12::/64', 'rl:client:d991078db0acb58826878adcf5a7b5bb6358779815ff0fdf12b34704c9e2b721'],
			['2001:0db8:abcd:0012:ffff::beef', '2001:db8:abcd:12::/64', 'rl:client:d991078db0acb58826878adcf5a7b5bb6358779815ff0fdf12b34704c9e2b721'],
			['2001:DB8:ABCD:12::1', '2001:db8:abcd:12::/64', 'rl:client:d991078db0acb58826878adcf5a7b5bb6358779815ff0fdf12b34704c9e2b721'],
			['2001:db8:abcd:13::1', '2001:db8:abcd:13::/64', 'rl:client:bae47d3520fdf858195d02a1fc5bb0cb3e086542c6567cac2aa4dec91ec890c9'],
			['[2001:db8::1]:443', '2001:db8:0:0::/64', 'rl:client:42a811b3aeda116832c837df8983efb8c7c0bd0466f45ae3799a9e6c62f898f2'],
			['fe80::1%eth0', 'fe80:0:0:0::/64', 'rl:client:74c60b762b586a22e9370bd09340674aaa56b7b9a062273480cab850a9a52171'],
			['::1', '0:0:0:0::/64', 'rl:client:742112100f073e06574d07b524df1da937d1dbc3778a11d9eee44fd19c68ca8c'],
			['::', '0:0:0:0::/64', 'rl:client:742112100f073e06574d07b524df1da937d1dbc3778a11d9eee44fd19c68ca8c'],
			['::ffff:192.0.2.44', '192.0.2.44', 'rl:client:56a3a23199091c9e65660176753124b8dfa1e0a90fca8534d6ca29c29199c856'],
			['::ffff:c000:022d', '192.0.2.45', 'rl:client:8f7f5cc1e0d47233b405b44623f0e0a89d493afeec8125a8ac9272b446ec5dd7'],
			['not-an-address', null, 'rl:fallback:30243bb3dbe1aa70adfb5b75cd490a08ed80bcb4336ffbd4975c8e73e6f57c75']
		];

		for (const [address, normalized, key] of golden) {
			expect(normalizeClientAddress(address)).toBe(normalized);
			expect(
				resolveRateLimitIdentity({
					identitySecret: IDENTITY_SECRET,
					getClientAddress: () => address
				}).key
			).toBe(key);
		}

		expect(resolveRateLimitIdentity({ identitySecret: IDENTITY_SECRET }).key).toBe(
			'rl:fallback:30243bb3dbe1aa70adfb5b75cd490a08ed80bcb4336ffbd4975c8e73e6f57c75'
		);
	});
});

describe('x-forwarded-for proxy chains', () => {
	// Regression: SvelteKit's Vercel adapter returns the raw x-forwarded-for header. Behind any
	// proxy or CDN that header is a chain. Before this was handled, every chained request
	// normalized to null and landed in the single shared fallback bucket, capping the whole
	// site at one budget while every other test stayed green.
	it('resolves the leftmost hop from a comma-separated chain', () => {
		expect(normalizeClientAddress('203.0.113.7, 70.41.3.18')).toBe('203.0.113.7');
		expect(normalizeClientAddress('203.0.113.7,70.41.3.18')).toBe('203.0.113.7');
		expect(normalizeClientAddress('203.0.113.7, 70.41.3.18, 150.172.238.178')).toBe(
			'203.0.113.7'
		);
	});

	it('resolves an IPv6 leftmost hop to its /64 network', () => {
		expect(normalizeClientAddress('2001:db8:85a3::8a2e:370:7334, 203.0.113.7')).toBe(
			'2001:db8:85a3:0::/64'
		);
	});

	it('keeps two clients behind the same proxy in different buckets', () => {
		const first = normalizeClientAddress('203.0.113.7, 70.41.3.18');
		const second = normalizeClientAddress('198.51.100.9, 70.41.3.18');
		expect(first).not.toBe(second);
		expect(first).not.toBeNull();
		expect(second).not.toBeNull();
	});

	it('still falls back when no hop is a usable address', () => {
		expect(normalizeClientAddress('')).toBeNull();
		expect(normalizeClientAddress('not-an-address, 203.0.113.7')).toBeNull();
	});

	it('is a no-op for a single unchained address', () => {
		expect(normalizeClientAddress('203.0.113.7')).toBe('203.0.113.7');
		expect(normalizeClientAddress('2001:db8:85a3::8a2e:370:7334')).toBe('2001:db8:85a3:0::/64');
	});
});
