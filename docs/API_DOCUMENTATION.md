# 📖 API Documentation - Eden Farm Game Backend

Backend REST API untuk Game Multiplayer **Eden Farm** berbasis Node.js, Express.js, dan SQLite.

- **Base URL Lokal:** `http://localhost:5000`
- **Format Pertukaran Data:** JSON (`Content-Type: application/json`)
- **Autentikasi:** JSON Web Token (JWT Bearer Token)

---

## 📋 Ringkasan Endpoint

| Method | Endpoint | Fungsi | Status Code | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health Check Server | `200 OK` | Memeriksa ketersediaan server |
| `POST` | `/api/register` | Pendaftaran Akun Pemain | `201 Created` / `400` / `409` | Menyimpan ke tabel `users` & `player_profiles` |
| `POST` | `/api/login` | Login Autentikasi Pemain | `200 OK` / `400` / `401` | Validasi Bcrypt & menerbitkan JWT Token |
| `POST` | `/api/score/save` | Update / Simpan Skor Match | `200 OK` / `400` / `404` | Menyimpan ke `scores` & update profil/rank |
| `PUT` | `/api/score/user/:userId` | Update Skor via Param URL | `200 OK` / `400` / `404` | RESTful alternatif untuk update skor user |
| `GET` | `/api/score/user/:userId` | View Skor per User ID | `200 OK` / `400` / `404` | Mengambil statistik profil & 5 riwayat match |
| `GET` | `/api/leaderboard` | View Scoreboard Top 10 | `200 OK` | Papan peringkat global (skor & pesanan) |

---

## 🛠️ Detail Spesifikasi Endpoint

### 1. Health Check
Memeriksa status aktif server game backend.

- **URL:** `/api/health`
- **Method:** `GET`
- **Response (`200 OK`):**
```json
{
  "status": "success",
  "message": "Game Backend Server is running successfully!",
  "serverTime": "2026-11-04T09:00:20.123Z"
}
```

---

### 2. Registrasi Akun Player (`POST /api/register`)
Mendaftarkan akun baru. Password dienkripsi dengan **Bcrypt (10 salt rounds)** ke tabel `users`, dan otomatis membuat profil awal di tabel `player_profiles` dengan tier default `Novice Planter`.

- **Headers:** `Content-Type: application/json`
- **Request Body (JSON):**
```json
{
  "username": "farmer_budi",
  "password": "secretpassword123",
  "nickname": "Budi Si Petani",
  "birthDate": "2002-08-17"
}
```
- **Response Sukses (`201 Created`):**
```json
{
  "status": "success",
  "message": "Akun player berhasil didaftarkan!",
  "userId": 1,
  "data": {
    "userId": 1,
    "username": "farmer_budi",
    "nickname": "Budi Si Petani",
    "rank": "Novice Planter"
  }
}
```

---

### 3. Login Autentikasi Player (`POST /api/login`)
Memverifikasi username dan password pemain. Jika valid, mengembalikan kredensial user, data profil & statistik in-game, serta **JSON Web Token (JWT)** dengan masa berlaku 24 jam.

- **Headers:** `Content-Type: application/json`
- **Request Body (JSON):**
```json
{
  "username": "farmer_budi",
  "password": "secretpassword123"
}
```
- **Response Sukses (`200 OK`):**
```json
{
  "status": "success",
  "message": "Login berhasil! Selamat datang di Eden Farm.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": 1,
  "data": {
    "userId": 1,
    "username": "farmer_budi",
    "nickname": "Budi Si Petani",
    "rank": "Novice Planter",
    "tierLevel": 1,
    "stats": {
      "farmsManaged": 0,
      "ordersCompleted": 0,
      "highestScore": 0
    }
  }
}
```

---

### 4. Update / Simpan Skor Match (`POST /api/score/save` atau `PUT /api/score/user/:userId`)
Mencatat hasil match pemain ke tabel `scores` (Relasi 1:N), memperbarui agregat di `player_profiles` (`highest_score`, `farms_managed_count` bertambah 1, `total_orders_completed`), dan secara otomatis mengevaluasi kenaikan tier `farm_ranks` pemain.

- **Headers:** `Content-Type: application/json`
- **Request Body (JSON):**
```json
{
  "userId": 1,
  "score": 350,
  "ordersCompleted": 40,
  "cropsHarvested": 60,
  "ordersLoaded": 40,
  "sessionId": "room-eden-01"
}
```
*Catatan:* Pada endpoint `PUT /api/score/user/:userId`, `userId` dapat diambil langsung dari parameter URL.

- **Response Sukses (`200 OK`):**
```json
{
  "status": "success",
  "message": "Skor berhasil diperbarui dan disimpan!",
  "scoreRecordId": 1,
  "addedScore": 350,
  "playerStats": {
    "userId": 1,
    "username": "farmer_budi",
    "nickname": "Budi Si Petani",
    "highestScore": 350,
    "farmsManaged": 1,
    "totalOrdersCompleted": 40,
    "currentRank": "Apprentice Farmer",
    "tierLevel": 2
  }
}
```

---

### 5. View Skor per User ID (`GET /api/score/user/:userId`)
Mengambil skor terbaik personal, akumulasi skor sepanjang waktu, rank tier saat ini, badge URL, total match yang dimainkan, serta 5 riwayat match terakhir pemain.

- **URL:** `/api/score/user/1`
- **Method:** `GET`
- **Response Sukses (`200 OK`):**
```json
{
  "status": "success",
  "message": "Data skor pemain Budi Si Petani berhasil diambil.",
  "data": {
    "userId": 1,
    "username": "farmer_budi",
    "nickname": "Budi Si Petani",
    "highestScore": 350,
    "cumulativeScore": 350,
    "rank": "Apprentice Farmer",
    "tierLevel": 2,
    "badgeIconUrl": "badges/apprentice.png",
    "stats": {
      "farmsManaged": 1,
      "totalOrdersCompleted": 40,
      "totalMatchesPlayed": 1
    },
    "recentMatches": [
      {
        "id": 1,
        "sessionId": "room-eden-01",
        "score": 350,
        "cropsHarvested": 60,
        "ordersLoaded": 40,
        "recordedAt": "2026-11-04 09:21:33"
      }
    ]
  }
}
```

---

### 6. View Scoreboard / Leaderboard Top 10 (`GET /api/leaderboard`)
Mengambil peringkat 10 pemain terbaik global berdasarkan skor tertinggi (`highest_score DESC`) dan total pesanan yang diselesaikan (`total_orders_completed DESC`).

- **URL:** `/api/leaderboard`
- **Method:** `GET`
- **Response Sukses (`200 OK`):**
```json
{
  "status": "success",
  "message": "Leaderboard Top 10 Eden Farm berhasil diambil.",
  "totalEntries": 2,
  "data": [
    {
      "position": 1,
      "userId": 1,
      "username": "farmer_budi",
      "nickname": "Budi Si Petani",
      "score": 350,
      "rank": "Apprentice Farmer",
      "tierLevel": 2,
      "badgeIconUrl": "badges/apprentice.png",
      "stats": {
        "ordersCompleted": 40,
        "farmsManaged": 1
      }
    }
  ]
}
```

---

## 📮 Pengujian Otomatis via Newman CLI

Seluruh pengujian endpoint (Health Check, Register, Login, Update Score POST & PUT, View Score, Leaderboard) dapat dijalankan:

```bash
npm test
```
- **Total Requests:** 9
- **Total Assertions:** 27
- **Status:** 100% Passed
