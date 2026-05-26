// src/lib/game.svelte.ts

export class Domino {
	// Properti ini diubah menjadi state agar saat batu diputar (flip), UI ikut update
	left = $state(0);
	right = $state(0);

	constructor(left: number, right: number) {
		this.left = left;
		this.right = right;
	}

	isBalak(): boolean {
		return this.left === this.right;
	}

	flip(): void {
		const temp = this.left;
		this.left = this.right;
		this.right = temp;
	}
}

export class Player {
	// Array hand dibuat reaktif. Saat kartu ditambah/dihapus, UI otomatis update.
	hand = $state<Domino[]>([]);

	constructor(
		public id: string,
		public name: string
	) {}

	receiveTiles(tiles: Domino[]) {
		// 1. Normalisasi: Pastikan angka terkecil selalu di sisi kiri
		tiles.forEach((tile) => {
			if (tile.left > tile.right) {
				tile.flip();
			}
		});

		// Masukkan kartu ke tangan pemain
		this.hand.push(...tiles);

		// 2. Urutkan kartu
		this.sortHand();
	}

	sortHand() {
		this.hand.sort((a, b) => {
			const totalA = a.left + a.right;
			const totalB = b.left + b.right;

			// Urutkan berdasarkan total nilai paling besar ke kecil
			if (totalA !== totalB) {
				return totalB - totalA;
			}

			// Jika totalnya sama (Tie-breaker),
			// urutkan berdasarkan angka tertingginya (yang sekarang pasti ada di sisi kanan)
			return b.right - a.right;
		});
	}

	playTile(index: number): Domino {
		return this.hand.splice(index, 1)[0];
	}
}

export class Board {
	// State meja
	playedTiles = $state<Domino[]>([]);
	leftEnd = $state<number | null>(null);
	rightEnd = $state<number | null>(null);

	canPlay(tile: Domino): boolean {
		if (this.playedTiles.length === 0) return true;
		return (
			tile.left === this.leftEnd ||
			tile.right === this.leftEnd ||
			tile.left === this.rightEnd ||
			tile.right === this.rightEnd
		);
	}

	playTile(tile: Domino, side: 'left' | 'right'): boolean {
		if (this.playedTiles.length === 0) {
			this.playedTiles.push(tile);
			this.leftEnd = tile.left;
			this.rightEnd = tile.right;
			return true;
		}

		if (side === 'left') {
			if (tile.right === this.leftEnd) {
				this.playedTiles.unshift(tile);
				this.leftEnd = tile.left;
				return true;
			} else if (tile.left === this.leftEnd) {
				tile.flip(); // Putar batu agar nyambung
				this.playedTiles.unshift(tile);
				this.leftEnd = tile.left;
				return true;
			}
		} else if (side === 'right') {
			if (tile.left === this.rightEnd) {
				this.playedTiles.push(tile);
				this.rightEnd = tile.right;
				return true;
			} else if (tile.right === this.rightEnd) {
				tile.flip();
				this.playedTiles.push(tile);
				this.rightEnd = tile.right;
				return true;
			}
		}

		return false; // Gerakan tidak valid
	}
}

export class GameManager {
	private deck: Domino[] = [];
	public players: Player[] = [];
	public board: Board;
	public turnIndex: number = 0;

	constructor(playerNames: string[]) {
		this.board = new Board();
		playerNames.forEach((name, i) => this.players.push(new Player(i.toString(), name)));
		this.generateDeck();
	}

	// Membuat 28 batu Domino standar (0|0 sampai 6|6)
	private generateDeck() {
		this.deck = [];
		for (let i = 0; i <= 6; i++) {
			for (let j = i; j <= 6; j++) {
				this.deck.push(new Domino(i, j));
			}
		}
	}

	// Algoritma Fisher-Yates untuk mengacak batu
	private shuffleDeck() {
		for (let i = this.deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
		}
	}

	// Membagikan masing-masing 7 batu ke 4 pemain
	public startGame() {
		if (this.players.length !== 4) throw new Error('Game butuh 4 pemain!');

		this.shuffleDeck();

		for (let i = 0; i < 4; i++) {
			const hand = this.deck.splice(0, 7);
			this.players[i].receiveTiles(hand);
		}

		// Opsional: Tentukan siapa yang jalan duluan (misal: yang punya balak 6|6)
		this.turnIndex = 0;
	}

	// Fungsi untuk pemain melakukan giliran
	public nextTurn(playerIndex: number, tileIndex: number, side: 'left' | 'right') {
		if (playerIndex !== this.turnIndex) {
			console.log('Bukan giliranmu!');
			return;
		}

		const currentPlayer = this.players[this.turnIndex];
		const tileToPlay = currentPlayer.hand[tileIndex];

		if (this.board.canPlay(tileToPlay)) {
			const success = this.board.playTile(tileToPlay, side);
			if (success) {
				currentPlayer.playTile(tileIndex); // Hapus dari tangan
				this.checkWinCondition(currentPlayer);
				this.turnIndex = (this.turnIndex + 1) % 4; // Lanjut ke pemain berikutnya
			}
		} else {
			console.log('Batu tidak valid untuk ditaruh di meja.');
		}
	}

	// Cek apakah pemain sudah habis batunya
	private checkWinCondition(player: Player) {
		if (player.hand.length === 0) {
			console.log(`Selamat! ${player.name} memenangkan game!`);
			// Trigger event game over di sini
		}
	}
}
