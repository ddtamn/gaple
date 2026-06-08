<script lang="ts">
	import './layout.css';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/client/auth';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();

	const session = authClient.useSession();

	const currentSession = $derived($session.data ?? data.session ?? null);
	const currentUser = $derived(currentSession?.user ?? data.user ?? null);

	async function signOut() {
		await authClient.signOut();
		await goto('/auth');
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-dvh">
	<div class="fixed right-4 top-4 z-50">
		{#if currentUser}
			<div class="flex items-center gap-3 rounded-full border border-stone-700/80 bg-background/90 px-4 py-2 shadow-2xl shadow-black/30 backdrop-blur">
				<div class="flex size-8 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
					{currentUser.name.slice(0, 1).toUpperCase()}
				</div>
				<div class="leading-tight">
					<p class="text-xs font-semibold text-stone-200">{currentUser.name}</p>
					<p class="text-[11px] text-stone-500">{currentUser.email}</p>
				</div>
				<button
					type="button"
					onclick={signOut}
					class="rounded-full border border-stone-700 px-3 py-1 text-xs font-semibold text-stone-300 transition hover:bg-warm-hover hover:text-stone-100"
				>
					Sign out
				</button>
			</div>
		{:else}
			<a
				href="/auth"
				class="rounded-full border border-stone-700 bg-background/90 px-4 py-2 text-sm font-semibold text-stone-200 shadow-2xl shadow-black/30 backdrop-blur transition hover:border-primary hover:text-white"
			>
				Sign in
			</a>
		{/if}
	</div>

	{@render children()}
</div>
