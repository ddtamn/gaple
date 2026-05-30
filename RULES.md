# Aturan Bermain Gaple (Domino Klasik)

## Pengenalan

Gaple adalah permainan kartu domino tradisional Indonesia yang dimainkan oleh **4 pemain**. Setiap pemain mendapat **7 kartu** dari total **28 kartu domino** (0-0 sampai 6-6). Tujuan permainan adalah **menghabiskan semua kartu di tangan** lebih dulu dari pemain lain.

---

## Kartu Domino

Satu set domino terdiri dari 28 kartu unik:

|         |         |         |         |         |         |         |
|---------|---------|---------|---------|---------|---------|---------|
| 0-0     | 0-1     | 0-2     | 0-3     | 0-4     | 0-5     | 0-6     |
| 1-1     | 1-2     | 1-3     | 1-4     | 1-5     | 1-6     |         |
| 2-2     | 2-3     | 2-4     | 2-5     | 2-6     |         |         |
| 3-3     | 3-4     | 3-5     | 3-6     |         |         |         |
| 4-4     | 4-5     | 4-6     |         |         |         |         |
| 5-5     | 5-6     |         |         |         |         |         |
| 6-6     |         |         |         |         |         |         |

**Kartu Balak (kembar):** Kartu dengan kedua sisi sama (0-0, 1-1, 2-2, 3-3, 4-4, 5-5, 6-6).

---

## Cara Bermain

### 1. Pembagian Kartu

- 28 kartu dikocok dan dibagi rata ke 4 pemain.
- Setiap pemain mendapat **7 kartu**.
- Tidak ada sisa kartu (draw pile) — semua kartu habis dibagi.

### 2. Penentuan Pemain Pertama

Babak pertama: Pemain yang memiliki **kartu balak 3 (3-3)** mendapat giliran pertama. Kartu 3-3 wajib dikeluarkan pertama kali.

Babak selanjutnya: Pemenang babak sebelumnya mendapat giliran pertama.

### 3. Alur Permainan

1. Pemain pertama meletakkan kartu 3-3 di tengah meja.
2. Giliran berputar searah jarum jam.
3. Setiap pemain harus meletakkan kartu yang **matching** dengan ujung kiri/kanan di papan.
4. Kartu dipasang berurutan membentuk ular/snake di meja.
5. Jika pemain **tidak punya kartu yang cocok**, mereka otomatis **pass** (giliran dilanjutkan ke pemain berikutnya).
6. Permainan berakhir ketika:
   - Seorang pemain **menghabiskan semua kartu** ("Kartu Habis")
   - **Semua pemain pass** berurutan ("Buntu" / "Gaple")

### 4. Aturan Melangkah

- Kartu harus matching: salah satu angka di kartu harus sama dengan angka di ujung kiri ATAU kanan papan.
- Kartu balak (kembar) dipasang menyamping/memutar (rotasi 90°).
- Pemain bisa memilih sisi kiri atau kanan untuk meletakkan kartu.
- Kartu bisa dibalik (flip) agar angka yang cocok menghadap ke ujung papan.

### Contoh:

Papan saat ini: `3-3` (kartu pertama)

Giliran pemain punya kartu `3-5` dan `2-3`:
- `3-5` bisa dipasang di kiri/kanan karena angka 3 cocok.
- `2-3` bisa dipasang di kiri/kanan karena angka 3 cocok.

Setelah meletakkan `3-5` di kanan, papan menjadi:
`3-3 | 3-5`

Ujung kiri = 3, ujung kanan = 5. Kartu selanjutnya harus memiliki angka 3 (kiri) atau 5 (kanan).

---

## Sistem Skor (Poin)

Gaple menggunakan sistem **poin ronde**. Setiap ronde, pemenang mendapat poin berdasarkan **cara menang**:

### 1. Kartu Habis / Normal — **1 poin**

Pemain menghabiskan kartu terakhirnya. Kartu terakhir bukan balak.

### 2. Palang (Balak) — **4 poin** 🏆

Pemain menutup dengan **kartu balak** (kembar). Ini adalah kemenangan tertinggi.

### 3. Cium Kiri-Kanan (Cecek) — **3 poin**

Kartu terakhir yang dimainkan bisa dimasukkan di **kedua ujung** papan (kiri dan kanan). Artinya kartu tersebut memiliki nilai yang cocok dengan kedua ujung yang terbuka.

### 4. Buntu / Gaple — **1 poin**

Semua pemain tidak bisa melangkah (pass). Pemenangnya adalah pemain dengan **total pip (titik) paling sedikit** di tangan.

Jika seri: pemain dengan jumlah kartu paling sedikit menang.

### 5. Kena Tembak (Buntu) — **2 poin**

Situasi buntu di mana pemenang **BUKAN** pemain yang terakhir meletakkan kartu. Pemain yang terakhir meletakkan kartu dianggap "kena tembak" dan lawannya mendapat 2 poin.

### 6. Cekik — **1 poin per cekikan**

Setiap kali seorang pemain pass, pemain yang membuatnya pass (pemain sebelumnya) mendapat **1 poin tambahan**. Poin ini diakumulasi langsung, bukan dari hasil akhir ronde.

---

## Ringkasan Skor

| Jenis Kemenangan     | Poin | Keterangan                                      |
|---------------------|------|-------------------------------------------------|
| Normal              | 1    | Habis kartu, kartu biasa                        |
| Cecek               | 3    | Kartu bisa masuk kiri & kanan                   |
| Palang (Balak)      | 4    | Menutup dengan kartu balak                      |
| Buntu (Mutlak)      | 1    | Semua pass, pemenang pip terkecil               |
| Kena Tembak         | 2    | Buntu, pemenang bukan yang terakhir main        |
| Cekik               | +1   | Setiap kali lawan pass                          |

---

## Mode Permainan

### 1. Vs AI (1 Pemain)

- Kamu (Pemain Bawah) vs 3 AI individu.
- Skor dihitung per pemain (Free For All).
- Poin akumulasi selama beberapa ronde.

### 2. Co-op Vs AI (2 Pemain + 2 AI)

- **Tim A (Manusia):** Seat 0 (kamu) + Seat 2 (teman)
- **Tim B (AI):** Seat 1 + Seat 3 (robot)
- Kamu dan teman satu tim bisa saling lihat kartu.
- Skor dihitung per tim.
- AI dalam satu tim juga bisa saling "tahu" kartu satu sama lain.
- Membutuhkan **2 pemain manusia** untuk memulai.

### 3. Co-op Vs Co-op (4 Pemain)

- **Tim A:** Seat 0 + Seat 2
- **Tim B:** Seat 1 + Seat 3
- Semua pemain adalah manusia.
- Skor dihitung per tim.
- Membutuhkan **4 pemain** untuk memulai (semua harus ready).

### Layout Tim (Co-op Mode)

| Seat | Posisi         | Tim  |
|------|---------------|------|
| 0    | Bawah (Kamu)  | A    |
| 1    | Kanan         | B    |
| 2    | Atas (Teman)  | A    |
| 3    | Kiri          | B    |

---

## Posisi Pemain di Papan

Di meja permainan, posisi pemain ditampilkan sebagai:

```
        [Pemain Atas / Seat 2]
              👤 Kartu

[Pemain Kiri]         [Pemain Kanan]
   👤 Kartu              👤 Kartu

        [Pemain Bawah / Seat 0] ← Kamu
              🃏 Kartu
```

Kartu kamu (Pemain Bawah) ditampilkan terbesar dan bisa diinteraksi (diklik/drag).
Kartu pemain lain ditampilkan lebih kecil (punggung kartu di mode vs AI).

---

## Istilah-Istilah

| Istilah            | Arti                                                      |
|--------------------|-----------------------------------------------------------|
| **Balak**          | Kartu kembar (kedua sisi sama)                           |
| **Cecek**          | Kartu bisa dimasukkan di kedua ujung papan               |
| **Cekik/Cekikan**  | Lawan terpaksa pass karena tidak punya kartu cocok       |
| **Gaple**          | Permainan buntu — semua pemain tidak bisa melangkah      |
| **Kena Tembak**    | Kalah karena orang lain yang buntu, bukan yang main terakhir |
| **Matching**       | Kartu cocok dengan ujung papan                           |
| **Palang**         | Kemenangan dengan kartu balak                            |
| **Pass**           | Tidak bisa meletakkan kartu (otomatis, tanpa tombol)     |
| **Pip**            | Titik/nilai pada kartu domino                            |
| **Ular/Snake**     | Susunan kartu di papan yang memanjang                    |

---

## Tips & Strategi

- **Keluarkan balak besar** (6-6, 5-5, 4-4) lebih awal agar tidak jadi beban poin.
- **Perhatikan ujung papan** — buka angka yang banyak kamu punya, tutup angka yang tidak kamu miliki.
- **Di co-op mode**, koordinasikan strategi dengan teman satu tim (lihat kartu mereka).
- **Simpan balak kecil** untuk palang (4 poin) di akhir permainan.
- **Hitung kartu** yang sudah keluar untuk memperkirakan kartu lawan.
- **Jaga pip rendah** — jika buntu, pemain dengan pip terkecil menang.

---

Selamat bermain Gaple! 🎲
