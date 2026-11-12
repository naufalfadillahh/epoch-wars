# Epoch Wars

Game strategi 2D adu benteng: kirim pasukan, bangun menara, dan berevolusi dari Zaman Batu sampai Zaman Masa Depan untuk menghancurkan benteng lawan.

**Main:** https://epoch-wars-naufal.vercel.app

## Fitur

- 4 zaman, masing-masing dengan 4 jenis pasukan, menara, dan serangan pamungkas
- 3 mode: duel satu keyboard, lawan komputer, dan mabar online dari perangkat berbeda
- Menara bertingkat: beli wadah dulu, lalu isi senapannya (maksimal 3), bisa dijual separuh harga
- Emote untuk meledek lawan
- Semua gambar dan suara dibuat lewat kode (Canvas 2D + Web Audio), tanpa aset gambar

## Mabar online

Buka game di dua perangkat, pilih **MABAR ONLINE**:

1. Pemain 1 klik **BUAT PERTANDINGAN** dan mengirim kode 4 huruf yang muncul.
2. Pemain 2 klik **MASUKKAN KODE** dan mengetik kode itu.

Di versi web, dua browser tersambung langsung lewat WebRTC (PeerJS). Pemain 1 menjalankan pertempuran, jadi tab-nya harus tetap terbuka.

### Mabar lewat WiFi yang sama (tanpa internet)

```
node server.js
```

Lalu buka alamat yang tercetak di kedua perangkat (di Windows bisa klik dua kali `mulai.bat`). Pertandingan temanmu muncul otomatis di lobi.

## Kontrol

| Aksi | Pemain 1 | Pemain 2 |
| --- | --- | --- |
| Pasukan | A S D F | J K L ; |
| Menara / Serangan pamungkas / Evolusi | Q / W / E | I / O / P |
| Wadah menara / Jual menara | T / R | Y / U |
| Emote | 1–5 | 6–0 |

Semua tombol juga bisa diklik atau disentuh. `Esc` jeda, `M` suara, `F3` penghitung FPS.

## Teknologi

HTML, JavaScript murni (Canvas 2D, Web Audio), WebRTC lewat PeerJS, dan server relay Node.js tanpa dependensi untuk mode WiFi.
