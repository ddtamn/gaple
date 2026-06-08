import { env } from '$env/dynamic/private';

type AuthEmail = {
	to: string;
	subject: string;
	text: string;
	html: string;
};

async function sendViaResend(email: AuthEmail) {
	const apiKey = env.RESEND_API_KEY;
	const from = env.AUTH_EMAIL_FROM ?? 'Gaple <onboarding@resend.dev>';

	if (!apiKey) return false;

	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from,
			to: [email.to],
			subject: email.subject,
			text: email.text,
			html: email.html
		})
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`Failed to send email via Resend (${response.status}): ${body}`);
	}

	return true;
}

export async function sendAuthEmail(email: AuthEmail) {
	const sent = await sendViaResend(email);
	if (sent) return;

	// Dev fallback: keep the flow usable even before email infrastructure is configured.
	console.warn('[auth-email] Email provider is not configured.');
	console.warn(`[auth-email] To: ${email.to}`);
	console.warn(`[auth-email] Subject: ${email.subject}`);
	console.warn(`[auth-email] Text: ${email.text}`);
}
