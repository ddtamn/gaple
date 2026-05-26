<script lang="ts">
	import { SvelteGameManager } from '$lib/game.svelte';

	const dotPatterns: Record<number, number[]> = {
		0: [0, 0, 0, 0, 0, 0, 0, 0, 0],
		1: [0, 0, 0, 0, 1, 0, 0, 0, 0],
		2: [1, 0, 0, 0, 0, 0, 0, 0, 1],
		3: [1, 0, 0, 0, 1, 0, 0, 0, 1],
		4: [1, 0, 1, 0, 0, 0, 1, 0, 1],
		5: [1, 0, 1, 0, 1, 0, 1, 0, 1],
		6: [1, 0, 1, 1, 0, 1, 1, 0, 1]
	};

	// Gunakan SvelteGameManager (Wrapper)
	const game = new SvelteGameManager(['Pemain Bawah', 'Pemain Kanan', 'Pemain Atas', 'Pemain Kiri']);
	game.startGame();

	// Konstanta Dimensi Kartu (Berdasarkan class w-28 h-14)
	const TILE_W = 112; // Lebar normal (Horizontal)
	const TILE_H = 56; // Tinggi normal
	const GAP = 8; // Jarak antar kartu
	const LIMIT = 350; // Batas X (pixel) dari tengah sebelum kartu berbelok ke bawah

	// Svelte 5: Otomatis menghitung ulang koordinat setiap kali meja berubah!
	let boardLayout = $derived.by(() => {
		const tiles = game.state.board.playedTiles;
		if (!tiles || tiles.length === 0) return [];

		const layout = [];
		let x = 0;
		let y = 0;
		let direction = 'RIGHT'; // Awal mulai jalan ke Kanan

		// Kita susun dari ujung kiri ke ujung kanan
		for (let i = 0; i < tiles.length; i++) {
			const tile = tiles[i];
			const isBalak = tile.left === tile.right;

			// Tentukan Dimensi Fisik kartu saat ini berdasarkan Arah (Direction)
			// Jika turun/naik, kartu diputar sehingga lebarnya jadi tinggi, tingginya jadi lebar
			let currentWidth = isBalak ? TILE_H : TILE_W;
			let currentHeight = isBalak ? TILE_W : TILE_H;
			if (direction === 'DOWN' || direction === 'UP') {
				currentWidth = isBalak ? TILE_W : TILE_H;
				currentHeight = isBalak ? TILE_H : TILE_W;
			}

			// Geser koordinat sebelum menaruh kartu (Kecuali kartu pertama)
			if (i > 0) {
				const prevTile = layout[i - 1];

				let prevWidth = prevTile.isBalak ? TILE_H : TILE_W;
				let prevHeight = prevTile.isBalak ? TILE_W : TILE_H;
				if (prevTile.direction === 'DOWN' || prevTile.direction === 'UP') {
					prevWidth = prevTile.isBalak ? TILE_W : TILE_H;
					prevHeight = prevTile.isBalak ? TILE_H : TILE_W;
				}

				// Menghitung jarak antar titik tengah (center-to-center)
				if (direction === 'RIGHT') {
					x += (prevWidth / 2) + (currentWidth / 2) + GAP;
					if (x > LIMIT) direction = 'DOWN'; // Terlalu ke kanan? Belok Bawah
				} else if (direction === 'LEFT') {
					x -= (prevWidth / 2) + (currentWidth / 2) + GAP;
					if (x < -LIMIT) direction = 'DOWN'; // Terlalu ke kiri? Belok Bawah
				} else if (direction === 'DOWN') {
					y += (prevHeight / 2) + (currentHeight / 2) + GAP;
					direction = x > 0 ? 'LEFT' : 'RIGHT'; // Habis belok bawah, pantulkan ke tengah
				}
			}

			// Tentukan Derajat Rotasi CSS
			let rotation = 0;
			if (direction === 'RIGHT') rotation = isBalak ? 90 : 0;
			else if (direction === 'DOWN') rotation = isBalak ? 0 : 90;
			else if (direction === 'LEFT') rotation = isBalak ? 90 : 180; // 180 agar angka tetap nyambung

			layout.push({ ...tile, x, y, rotation, isBalak, direction });
		}

		// --- AUTO CENTERING (Fokus Kamera) ---
		// Cari titik tengah dari seluruh kartu yang ada,
		// lalu geser semuanya agar meja selalu seimbang di tengah layar
		const minX = Math.min(...layout.map((t) => t.x));
		const maxX = Math.max(...layout.map((t) => t.x));
		const minY = Math.min(...layout.map((t) => t.y));
		const maxY = Math.max(...layout.map((t) => t.y));

		const centerX = (minX + maxX) / 2;
		const centerY = (minY + maxY) / 2;

		return layout.map((t) => ({
			...t,
			x: t.x - centerX,
			y: t.y - centerY
		}));
	});
</script>

{#snippet DominoTile(tile: { left: number; right: number }, isVertical: boolean)}
	<div
		class="flex overflow-hidden rounded-xl bg-neutral-200 shadow-md transition-transform {isVertical
			? 'flex-col h-28 w-14'
			: 'flex-row h-14 w-28'}"
	>
		<div class="grid flex-1 grid-cols-3 grid-rows-3 place-items-center gap-1 p-2 {!isVertical ? 'rotate-90' : ''}">
			{#each dotPatterns[tile.left] as hasDot, j (j)}
				<div class="h-2 w-2 rounded-full {hasDot ? 'bg-red-700' : 'bg-transparent'}"></div>
			{/each}
		</div>
		<div class="flex items-center justify-center {isVertical ? 'h-px w-full' : 'h-full w-px'}">
			<div class="{isVertical ? 'h-full w-[70%]' : 'h-[70%] w-full'} bg-red-700/25"></div>
		</div>
		<div class="grid flex-1 grid-cols-3 grid-rows-3 place-items-center gap-1 p-2 {!isVertical ? 'rotate-90' : ''}">
			{#each dotPatterns[tile.right] as hasDot, j (j)}
				<div class="h-2 w-2 rounded-full {hasDot ? 'bg-red-700' : 'bg-transparent'}"></div>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet PlayerHand(index: number)}
	{@const isVertical = index === 0 || index === 2}
	{@const player = game.state.players[index]}
	
	{#each player.hand as tile (tile.id)}
		<button
			disabled={game.state.turnIndex !== index}
			onclick={() => {
				// Coba mainkan ke kanan, kalau tidak bisa, sistem akan menolak 
				// (Nanti UI bisa dibuat lebih canggih dengan drag-and-drop / pilih sisi)
				game.nextTurn(player.id, tile.id, 'right') || game.nextTurn(player.id, tile.id, 'left');
			}}
			class="flex cursor-pointer transition-transform {isVertical ? 'hover:-translate-y-2' : 'hover:-translate-x-2'} 
                   {game.state.turnIndex === index ? 'opacity-100 ring-2 ring-yellow-400 rounded-xl' : 'opacity-70'}"
		>
			{@render DominoTile(tile, isVertical)}
		</button>
	{/each}
{/snippet}

<div class="relative flex h-screen w-full items-center justify-center bg-neutral-900 text-white">
	
	<div class="absolute top-4 left-4 z-10 text-sm">
		<p class="font-bold text-yellow-400">Giliran: {game.state.players[game.state.turnIndex].name}</p>
		<button 
			class="mt-2 bg-neutral-700 px-3 py-1 rounded hover:bg-neutral-600"
			onclick={() => game.passTurn(game.state.players[game.state.turnIndex].id)}
		>
			Lewati Giliran (Pass)
		</button>
	</div>

	<div class="flex flex-wrap items-center justify-center gap-1 p-10 z-0">
		<div class="relative flex h-[500px] w-full max-w-[900px] items-center justify-center overflow-hidden rounded-3xl bg-green-950/30 ring-2 ring-green-900 shadow-inner">
			{#if game.state.board.playedTiles.length === 0}
				<p class="text-neutral-500 font-bold text-lg">Meja kosong. Pemain pertama mulai.</p>
			{:else}
				{#each boardLayout as tile (tile.id)}
					{@const isRotated = tile.rotation === 90 || tile.rotation === 270}
					{@const offsetX = isRotated ? TILE_H / 2 : TILE_W / 2}
					{@const offsetY = isRotated ? TILE_W / 2 : TILE_H / 2}
					<div
						class="absolute transition-all duration-500 ease-out"
						style="transform: translate({tile.x - offsetX}px, {tile.y - offsetY}px) rotate({tile.rotation}deg);"
					>
						{@render DominoTile(tile, false)}
					</div>
				{/each}
			{/if}
		</div>
	</div>

	{#each game.state.players as player, i (player.id)}
		<div
			class="absolute flex gap-2 z-10
				{i === 0 ? 'bottom-4 left-1/2 -translate-x-1/2 flex-row' : 
				 i === 1 ? 'top-1/2 right-4 -translate-y-1/2 flex-col-reverse' : 
				 i === 2 ? 'top-4 left-1/2 -translate-x-1/2 flex-row' : 
				 'top-1/2 left-4 -translate-y-1/2 flex-col'}"
		>
			{@render PlayerHand(i)}
		</div>
	{/each}
</div>