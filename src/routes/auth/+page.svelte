<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/client/auth';

	type Tab = 'signin' | 'signup' | 'magic';

	let { data } = $props();

	const session = authClient.useSession();

	type SessionView = {
		user: {
			id: string;
			name: string;
			email: string;
			image?: string | null;
		};
		profileId?: string | null;
	} | null;

	let activeTab = $state<Tab>('signin');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let feedback = $state('');
	let errorMessage = $state('');
	let loading = $state(false);

	const currentSession = $derived((($session.data as SessionView) ?? data.session ?? null));
	const currentUser = $derived(currentSession?.user ?? data.user ?? null);

	function resetFeedback() {
		feedback = '';
		errorMessage = '';
	}

	function normalizeError(error: unknown) {
		if (error instanceof Error) return error.message;
		if (typeof error === 'string') return error;
		return 'Terjadi kesalahan saat memproses autentikasi.';
	}

	async function handleEmailPassword(kind: 'signin' | 'signup') {
		resetFeedback();
		loading = true;

		try {
			if (!email.trim() || !password.trim()) {
				throw new Error('Email dan password harus diisi.');
			}

			if (kind === 'signup') {
				if (!name.trim()) throw new Error('Nama wajib diisi saat daftar.');
				if (password.length < 8) throw new Error('Password minimal 8 karakter.');
				if (password !== confirmPassword) throw new Error('Konfirmasi password tidak cocok.');
				await authClient.signUp.email({
					email: email.trim(),
					password,
					name: name.trim(),
					callbackURL: '/'
				});
				feedback = 'Akun berhasil dibuat. Kamu akan diarahkan ke game.';
			} else {
				await authClient.signIn.email({
					email: email.trim(),
					password,
					callbackURL: '/'
				});
				feedback = 'Login berhasil. Kamu akan diarahkan ke game.';
			}

			setTimeout(() => goto('/'), 700);
		} catch (error) {
			errorMessage = normalizeError(error);
		} finally {
			loading = false;
		}
	}

	async function handleMagicLink() {
		resetFeedback();
		loading = true;

		try {
			if (!email.trim()) throw new Error('Email harus diisi untuk magic link.');

			await authClient.signIn.magicLink({
				email: email.trim(),
				name: name.trim() || undefined,
				callbackURL: '/',
				newUserCallbackURL: '/',
				errorCallbackURL: '/auth'
			});

			feedback = 'Link login sudah dikirim. Cek inbox email kamu.';
		} catch (error) {
			errorMessage = normalizeError(error);
		} finally {
			loading = false;
		}
	}

	async function handleSocial(provider: 'github' | 'google') {
		resetFeedback();
		loading = true;

		try {
			await authClient.signIn.social({
				provider,
				callbackURL: '/'
			});
		} catch (error) {
			errorMessage = normalizeError(error);
			loading = false;
		}
	}

	async function handleSignOut() {
		resetFeedback();
		loading = true;
		try {
			await authClient.signOut();
			await goto('/');
		} catch (error) {
			errorMessage = normalizeError(error);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Auth | Gaple</title>
	<meta
		name="description"
		content="Masuk ke Gaple dengan email, magic link, GitHub, atau Google."
	/>
</svelte:head>

<div class="relative min-h-dvh overflow-hidden bg-background text-stone-100">
	<div class="pointer-events-none absolute inset-0 opacity-40">
		<div class="absolute -top-24 left-[-10%] h-80 w-80 rounded-full bg-primary/40 blur-[110px]"></div>
		<div class="absolute top-40 right-[-8%] h-96 w-96 rounded-full bg-secondary/30 blur-[120px]"></div>
		<div class="absolute bottom-[-12%] left-1/3 h-96 w-96 rounded-full bg-tertiary/20 blur-[130px]"></div>
	</div>

	<div class="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl items-center px-4 py-10 md:px-6">
		<div class="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
			<section class="flex flex-col justify-between rounded-3xl border border-stone-700/70 bg-surface/90 p-8 shadow-2xl shadow-black/30 backdrop-blur md:p-10">
				<div class="max-w-xl">
					<a href="/" class="inline-flex items-center gap-2 text-sm font-semibold text-stone-400 transition hover:text-stone-200">
						<span class="rounded-full bg-primary/20 px-2 py-1 text-xs text-primary">Gaple</span>
						Kembali ke beranda
					</a>

					<h1 class="mt-6 bg-gradient-to-br from-primary via-secondary to-stone-100 bg-clip-text font-headline text-5xl font-black tracking-tight text-transparent md:text-7xl">
						Satu akun untuk semua mode
					</h1>

					<p class="mt-5 max-w-lg text-base leading-7 text-stone-300 md:text-lg">
						Masuk sekali, lalu main local vs AI, room multiplayer, dan leaderboard tanpa pindah-pindah sistem. Magic link, GitHub, dan Google semuanya tersedia di satu tempat.
					</p>
				</div>

				<div class="mt-10 grid gap-3 sm:grid-cols-3">
					<div class="rounded-2xl border border-stone-700 bg-background/60 p-4">
						<p class="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Magic link</p>
						<p class="mt-2 text-sm text-stone-300">Masuk tanpa password lewat email.</p>
					</div>
					<div class="rounded-2xl border border-stone-700 bg-background/60 p-4">
						<p class="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Social login</p>
						<p class="mt-2 text-sm text-stone-300">GitHub dan Google siap dipakai.</p>
					</div>
					<div class="rounded-2xl border border-stone-700 bg-background/60 p-4">
						<p class="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Profile sync</p>
						<p class="mt-2 text-sm text-stone-300">Akun langsung nyambung ke `profiles`.</p>
					</div>
				</div>
			</section>

			<section class="rounded-3xl border border-stone-700/70 bg-background/90 p-6 shadow-2xl shadow-black/30 backdrop-blur md:p-8">
				{#if currentUser}
					<div class="flex h-full flex-col justify-between gap-6">
						<div>
							<p class="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">Signed in</p>
							<h2 class="mt-2 font-headline text-3xl font-semibold text-stone-100">
								{currentUser.name}
							</h2>
							<p class="mt-2 text-sm text-stone-400">{currentUser.email}</p>

							{#if currentSession?.profileId}
								<div class="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
									<p class="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Profile ready</p>
									<p class="mt-2 text-sm text-emerald-100">
										Profile ID: <span class="font-mono text-xs">{currentSession.profileId}</span>
									</p>
								</div>
							{/if}
						</div>

						<div class="flex flex-col gap-3">
							<a
								href="/"
								class="rounded-xl bg-primary px-5 py-3 text-center font-semibold text-white transition hover:bg-primary-hover active:scale-[0.99]"
							>
								Lanjut ke game
							</a>
							<button
								type="button"
								onclick={handleSignOut}
								disabled={loading}
								class="rounded-xl border border-stone-700 bg-surface px-5 py-3 font-semibold text-stone-200 transition hover:bg-warm-hover disabled:opacity-60"
							>
								{loading ? 'Signing out...' : 'Sign out'}
							</button>
						</div>
					</div>
				{:else}
					<div>
						<div class="flex gap-2 rounded-2xl border border-stone-700 bg-surface p-1">
							{#each [
								{ id: 'signin', label: 'Sign in' },
								{ id: 'signup', label: 'Sign up' },
								{ id: 'magic', label: 'Magic link' }
							] as tab}
								<button
									type="button"
									class={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
										activeTab === tab.id
											? 'bg-primary text-white shadow-lg shadow-primary/20'
											: 'text-stone-400 hover:text-stone-100'
									}`}
									onclick={() => {
										activeTab = tab.id as Tab;
										resetFeedback();
									}}
								>
									{tab.label}
								</button>
							{/each}
						</div>

						<div class="mt-6 grid gap-3 sm:grid-cols-2">
							<button
								type="button"
								onclick={() => handleSocial('github')}
								class="rounded-xl border border-stone-700 bg-surface px-4 py-3 text-sm font-semibold text-stone-100 transition hover:border-stone-500 hover:bg-warm-hover"
							>
								Continue with GitHub
							</button>
							<button
								type="button"
								onclick={() => handleSocial('google')}
								class="rounded-xl border border-stone-700 bg-surface px-4 py-3 text-sm font-semibold text-stone-100 transition hover:border-stone-500 hover:bg-warm-hover"
							>
								Continue with Google
							</button>
						</div>

						<div class="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-stone-500">
							<span class="h-px flex-1 bg-stone-800"></span>
							atau
							<span class="h-px flex-1 bg-stone-800"></span>
						</div>

						<form
							class="space-y-4"
							onsubmit={(event) => {
								event.preventDefault();
								handleEmailPassword(activeTab === 'signup' ? 'signup' : 'signin');
							}}
						>
							{#if activeTab === 'signup'}
								<div>
									<label for="name" class="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Nama</label>
									<input
										id="name"
										bind:value={name}
										autocomplete="name"
										placeholder="Nama tampilan"
										class="w-full rounded-xl border border-stone-700 bg-surface px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-primary focus:ring-1 focus:ring-primary"
									/>
								</div>
							{/if}

							<div>
								<label for="email" class="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Email</label>
								<input
									id="email"
									bind:value={email}
									type="email"
									autocomplete="email"
									placeholder="nama@email.com"
									class="w-full rounded-xl border border-stone-700 bg-surface px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-primary focus:ring-1 focus:ring-primary"
								/>
							</div>

							{#if activeTab !== 'magic'}
								<div>
									<label for="password" class="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Password</label>
									<input
										id="password"
										bind:value={password}
										type="password"
										autocomplete={activeTab === 'signup' ? 'new-password' : 'current-password'}
										placeholder="Minimal 8 karakter"
										class="w-full rounded-xl border border-stone-700 bg-surface px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-primary focus:ring-1 focus:ring-primary"
									/>
								</div>

								{#if activeTab === 'signup'}
									<div>
										<label for="confirm-password" class="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Konfirmasi password</label>
										<input
											id="confirm-password"
											bind:value={confirmPassword}
											type="password"
											autocomplete="new-password"
											placeholder="Ulangi password"
											class="w-full rounded-xl border border-stone-700 bg-surface px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-primary focus:ring-1 focus:ring-primary"
										/>
									</div>
								{/if}
							{/if}

							<button
								type="submit"
								disabled={loading}
								class="w-full rounded-xl bg-primary px-5 py-3.5 font-semibold text-white transition hover:bg-primary-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
							>
								{#if loading}
									Memproses...
								{:else if activeTab === 'magic'}
									Kirim magic link
								{:else if activeTab === 'signup'}
									Buat akun
								{:else}
									Masuk
								{/if}
							</button>
						</form>

						{#if activeTab === 'magic'}
							<p class="mt-4 text-sm text-stone-400">
								Link login akan dikirim ke email kamu. Pastikan `RESEND_API_KEY` dan `AUTH_EMAIL_FROM` sudah di-set agar email benar-benar terkirim.
							</p>
						{/if}

						{#if feedback}
							<div class="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
								{feedback}
							</div>
						{/if}

						{#if errorMessage}
							<div class="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
								{errorMessage}
							</div>
						{/if}
					</div>
				{/if}
			</section>
		</div>
	</div>
</div>
