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
| `POST` | `/api/score/save` | Simpan Skor Match (Draft) | `501 Not Implemented` | Tahap pengembangan berikutnya |
| `GET` | `/api/leaderboard` | Top 10 Skor (Draft) | `501 Not Implemented` | Tahap pengembangan berikutnya |

---

## 🛠️ Detail Spesifikasi Endpoint

### 1. Health Check
Memeriksa status aktif server game backend.

- **URL:** `/api/health`
- **Method:** `GET`
- **Headers:** *(None)*
- **Body:** *(None)*

**Response Sukses (`200 OK`):**
```json
{
  "status": "success",
  "message": "Game Backend Server is running successfully!",
  "serverTime": "2026-11-04T09:00:20.123Z"
}
```

---

### 2. Registrasi Akun Player (`/api/register`)
Mendaftarkan akun baru. Password dienkripsi dengan **Bcrypt (10 salt rounds)** ke tabel `users`, dan otomatis membuat profil awal di tabel `player_profiles` dengan tier default `Novice Planter`.

- **URL:** `/api/register`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "username": "farmer_budi",
  "password": "secretpassword123",
  "nickname": "Budi Si Petani",
  "birthDate": "2002-08-17"
}
```
*Catatan:* Field `nickname` dan `birthDate` bersifat opsional. Jika `nickname` kosong, akan menggunakan nilai `username`.

**Response Sukses (`201 Created`):**
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

**Response Error - Duplikasi Username (`409 Conflict`):**
```json
{
  "status": "error",
  "message": "Username sudah digunakan, silakan pilih username lain!"
}
```

**Response Error - Validasi Input (`400 Bad Request`):**
```json
{
  "status": "error",
  "message": "Username dan password wajib diisi!"
}
```

---

### 3. Login Autentikasi Player (`/api/login`)
Memverifikasi username dan password pemain. Jika valid, mengembalikan kredensial user, data profil & statistik in-game, serta **JSON Web Token (JWT)** dengan masa berlaku 24 jam.

- **URL:** `/api/login`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "username": "farmer_budi",
  "password": "secretpassword123"
}
```

**Response Sukses (`200 OK`):**
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

**Response Error - Kredensial Salah (`401 Unauthorized`):**
```json
{
  "status": "error",
  "message": "Username atau password tidak valid!"
}
```

---

### 4. Simpan Skor Akhir Match (`/api/score/save` - Draft)
- **URL:** `/api/score/save`
- **Method:** `POST`
- **Body:** `{"userId": 1, "score": 100}`
- **Response (`501 Not Implemented`):**
```json
{
  "message": "Endpoint /api/score/save belum diimplementasikan"
}
```

---

### 5. Leaderboard Global (`/api/leaderboard` - Draft)
- **URL:** `/api/leaderboard`
- **Method:** `GET`
- **Response (`501 Not Implemented`):**
```json
{
  "message": "Endpoint /api/leaderboard belum diimplementasikan"
}
```

---

## 📮 Pengujian via Postman CLI (Newman)

Seluruh pengujian endpoint (Health Check, Register Positif/Negatif, Login Positif/Negatif, Drafts) dapat dijalankan langsung melalui CLI:

```bash
npm test
```
File collection: [`postman/Game_Backend_Modul8.postman_collection.json`](./postman/Game_Backend_Modul8.postman_collection.json)  
File environment: [`postman/Local_Environment.postman_environment.json`](./postman/Local_Environment.postman_environment.json)
