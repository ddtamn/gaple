// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			session: {
				user: {
					id: string;
					name: string;
					email: string;
					image?: string | null;
				};
				session: {
					id: string;
					userId: string;
					expiresAt: Date;
				};
				profileId?: string | null;
				isBot?: boolean;
			} | null;
			user: {
				id: string;
				name: string;
				email: string;
				image?: string | null;
			} | null;
		}

		interface PageData {
			session: App.Locals['session'];
			user: App.Locals['user'];
		}
	}
}

export {};
