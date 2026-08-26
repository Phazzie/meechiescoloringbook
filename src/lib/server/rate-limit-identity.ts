// Purpose: Derive pseudonymous rate-limit identities from server-resolved client addresses.
// Why: Durable quota keys must group IPv6 /64 networks without storing raw network addresses.
// Info flow: client-address lookup + required secret -> normalized address -> HMAC-SHA256 key.
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export type RateLimitIdentity = {
	key: string;
	kind: 'pseudonymous' | 'fallback';
};

export type RateLimitIdentityInput = {
	identitySecret: string;
	getClientAddress?: () => string | undefined;
};

export class RateLimitIdentityConfigError extends Error {
	constructor() {
		super('Rate limit identity configuration is invalid.');
		this.name = 'RateLimitIdentityConfigError';
	}
}

const replaceEmbeddedIpv4 = (value: string): string | null => {
	if (!value.includes('.')) return value;
	const lastColon = value.lastIndexOf(':');
	if (lastColon < 0) return null;
	const ipv4 = value.slice(lastColon + 1);
	if (isIP(ipv4) !== 4) return null;
	const octets = ipv4.split('.').map(Number);
	const high = ((octets[0] << 8) | octets[1]).toString(16);
	const low = ((octets[2] << 8) | octets[3]).toString(16);
	return `${value.slice(0, lastColon + 1)}${high}:${low}`;
};

const expandIpv6 = (value: string): number[] | null => {
	const withoutEmbeddedIpv4 = replaceEmbeddedIpv4(value);
	if (!withoutEmbeddedIpv4) return null;
	const sides = withoutEmbeddedIpv4.split('::');
	if (sides.length > 2) return null;
	const left = sides[0] ? sides[0].split(':') : [];
	const right = sides.length === 2 && sides[1] ? sides[1].split(':') : [];
	const missing = 8 - left.length - right.length;
	if ((sides.length === 1 && missing !== 0) || (sides.length === 2 && missing < 1)) {
		return null;
	}
	const parts = [
		...left,
		...Array.from({ length: missing }, () => '0'),
		...right
	];
	if (parts.length !== 8) return null;
	const numbers = parts.map((part) => Number.parseInt(part, 16));
	return numbers.every((part) => Number.isInteger(part) && part >= 0 && part <= 0xffff)
		? numbers
		: null;
};

const ipv4FromMappedParts = (parts: readonly number[]): string | null => {
	if (
		parts.length !== 8 ||
		!parts.slice(0, 5).every((part) => part === 0) ||
		parts[5] !== 0xffff
	) {
		return null;
	}
	const high = parts[6];
	const low = parts[7];
	return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
};

export const normalizeClientAddress = (value: string): string | null => {
	let candidate = value.trim().toLowerCase();
	if (candidate.startsWith('[')) {
		const closingBracket = candidate.indexOf(']');
		if (closingBracket < 0) return null;
		candidate = candidate.slice(1, closingBracket);
	}
	const zoneIndex = candidate.indexOf('%');
	if (zoneIndex >= 0) candidate = candidate.slice(0, zoneIndex);

	if (isIP(candidate) === 4) return candidate;
	if (isIP(candidate) !== 6) return null;

	const expanded = expandIpv6(candidate);
	if (!expanded) return null;
	const mappedIpv4 = ipv4FromMappedParts(expanded);
	if (mappedIpv4) return mappedIpv4;
	return `${expanded
		.slice(0, 4)
		.map((part) => part.toString(16))
		.join(':')}::/64`;
};

const hmacKey = (secret: string, kind: 'client' | 'fallback', value: string): string => {
	const digest = createHmac('sha256', secret).update(`${kind}:${value}`).digest('hex');
	return `rl:${kind}:${digest}`;
};

export const resolveRateLimitIdentity = (
	input: RateLimitIdentityInput
): RateLimitIdentity => {
	if (typeof input.identitySecret !== 'string' || input.identitySecret.trim().length === 0) {
		throw new RateLimitIdentityConfigError();
	}

	let address: string | undefined;
	try {
		address = input.getClientAddress?.();
	} catch {
		address = undefined;
	}
	const normalized = address ? normalizeClientAddress(address) : null;
	if (!normalized) {
		return {
			key: hmacKey(input.identitySecret, 'fallback', 'shared'),
			kind: 'fallback'
		};
	}

	return {
		key: hmacKey(input.identitySecret, 'client', normalized),
		kind: 'pseudonymous'
	};
};
