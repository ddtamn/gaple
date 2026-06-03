import { auth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const { handler } = auth;

export const GET: RequestHandler = async (event) => {
	return handler(event.request);
};

export const POST: RequestHandler = async (event) => {
	return handler(event.request);
};

export const PUT: RequestHandler = async (event) => {
	return handler(event.request);
};

export const DELETE: RequestHandler = async (event) => {
	return handler(event.request);
};

export const PATCH: RequestHandler = async (event) => {
	return handler(event.request);
};
