import crypto from 'node:crypto';

export const normalizeUrl = (input: string): string => {
	const value = input.trim();

	try {
		const parsed = new URL(value);

		parsed.hash = '';
		parsed.protocol = parsed.protocol.toLowerCase();
		parsed.hostname = parsed.hostname.toLowerCase();

		const sortedParams = new URLSearchParams(parsed.search);
		sortedParams.sort();
		parsed.search = sortedParams.toString();

		return parsed.toString().replace(/\/$/, '');
	} catch {
		// Fallback for malformed URLs to keep behavior deterministic.
		return value.toLowerCase().replace(/\/$/, '');
	}
};

export const hashUrl = (input: string): string => {
	const normalized = normalizeUrl(input);
	return crypto.createHash('sha256').update(normalized).digest('hex');
};
