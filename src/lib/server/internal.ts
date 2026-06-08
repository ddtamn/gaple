import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import crypto from 'node:crypto';
import { PARTYKIT_INTERNAL_HEADER } from '$lib/internal-auth';

export function getPartykitInternalToken() {
	return env.PARTYKIT_INTERNAL_TOKEN ?? '';
}

export function requirePartykitInternalToken() {
	const token = getPartykitInternalToken();
	if (!token) {
		throw new Error('PARTYKIT_INTERNAL_TOKEN is not configured.');
	}
	return token;
}

export function assertInternalPartykitRequest(request: Request) {
	const expected = requirePartykitInternalToken();
	const received = request.headers.get(PARTYKIT_INTERNAL_HEADER);

	if (!received) {
		throw error(401, 'Missing internal PartyKit token');
	}

	const expectedBytes = Buffer.from(expected);
	const receivedBytes = Buffer.from(received);

	if (expectedBytes.length !== receivedBytes.length || !crypto.timingSafeEqual(expectedBytes, receivedBytes)) {
		throw error(403, 'Invalid internal PartyKit token');
	}
}
