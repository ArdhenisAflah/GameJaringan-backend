// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// Middleware
// ==========================================
// Menerima request lintas domain/port dari Game Client Unity
app.use(cors());

// Menerima request body dengan payload berformat JSON
app.use(express.json());

// ==========================================
// Routes / Endpoints
// ==========================================

// Route Root (Redirect / sambutan untuk akses langsung dari browser)
app.get('/', (req, res) => {
  res.redirect('/api/health');
});

// 1. Endpoint Health Check (Pengujian Awal Server)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Game Backend Server is running successfully!',
    serverTime: new Date().toISOString()
  });
});

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'eden_farm_fallback_secret_key_2026';

// 2. Endpoint Registrasi Akun Player Baru
app.post('/api/register', async (req, res) => {
  const { username, password, nickname, birthDate } = req.body;

  // Validasi input wajib
  if (!username || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Username dan password wajib diisi!'
    });
  }

  const cleanUsername = String(username).trim();
  const cleanPassword = String(password);

  if (cleanUsername.length < 3) {
    return res.status(400).json({
      status: 'error',
      message: 'Username minimal harus memiliki 3 karakter!'
    });
  }

  if (cleanPassword.length < 6) {
    return res.status(400).json({
      status: 'error',
      message: 'Password minimal harus memiliki 6 karakter!'
    });
  }

  const displayNickname = (nickname && String(nickname).trim()) || cleanUsername;
  const userBirthDate = birthDate ? String(birthDate) : null;

  try {
    // Cek apakah username sudah terdaftar di database
    db.get('SELECT id FROM users WHERE username = ?', [cleanUsername], async (err, existingUser) => {
      if (err) {
        return res.status(500).json({
          status: 'error',
          message: 'Terjadi kesalahan pada database saat memeriksa user.',
          error: err.message
        });
      }

      if (existingUser) {
        return res.status(409).json({
          status: 'error',
          message: 'Username sudah digunakan, silakan pilih username lain!'
        });
      }

      // Hash password dengan bcrypt
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(cleanPassword, salt);

      // Simpan user baru ke tabel users
      db.run(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        [cleanUsername, passwordHash],
        function (insertErr) {
          if (insertErr) {
            return res.status(500).json({
              status: 'error',
              message: 'Gagal membuat akun user.',
              error: insertErr.message
            });
          }

          const newUserId = this.lastID;

          // Buat entitas player_profiles otomatis (Relasi 1:1 ke users)
          db.run(
            `INSERT INTO player_profiles (user_id, current_rank_id, nickname, birth_date)
             VALUES (?, 1, ?, ?)`,
            [newUserId, displayNickname, userBirthDate],
            (profileErr) => {
              if (profileErr) {
                console.error('Peringatan: Gagal membuat profil default:', profileErr.message);
              }

              // Format response sesuai standar Modul 8 & detail profil Eden Farm
              return res.status(201).json({
                status: 'success',
                message: 'Akun player berhasil didaftarkan!',
                userId: newUserId,
                data: {
                  userId: newUserId,
                  username: cleanUsername,
                  nickname: displayNickname,
                  rank: 'Novice Planter'
                }
              });
            }
          );
        }
      );
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kegagalan server internal.',
      error: error.message
    });
  }
});

// 3. Endpoint Autentikasi / Login Player
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Username dan password wajib diisi!'
    });
  }

  const cleanUsername = String(username).trim();
  const cleanPassword = String(password);

  // Ambil user dan gabungkan dengan player_profiles serta farm_ranks
  const query = `
    SELECT 
      u.id AS userId,
      u.username,
      u.password_hash,
      p.nickname,
      p.farms_managed_count,
      p.total_orders_completed,
      p.highest_score,
      r.rank_name AS current_rank,
      r.tier_level
    FROM users u
    LEFT JOIN player_profiles p ON u.id = p.user_id
    LEFT JOIN farm_ranks r ON p.current_rank_id = r.id
    WHERE u.username = ?
  `;

  db.get(query, [cleanUsername], async (err, user) => {
    if (err) {
      return res.status(500).json({
        status: 'error',
        message: 'Terjadi kesalahan saat memeriksa kredensial login.',
        error: err.message
      });
    }

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Username atau password tidak valid!'
      });
    }

    // Verifikasi hash password
    const isPasswordMatch = await bcrypt.compare(cleanPassword, user.password_hash);
    if (!isPasswordMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Username atau password tidak valid!'
      });
    }

    // Buat JWT Token (masa berlaku 24 jam)
    const tokenPayload = {
      userId: user.userId,
      username: user.username
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    // Format response sesuai API Contract Modul 8
    return res.status(200).json({
      status: 'success',
      message: 'Login berhasil! Selamat datang di Eden Farm.',
      token: token,
      userId: user.userId,
      data: {
        userId: user.userId,
        username: user.username,
        nickname: user.nickname || user.username,
        rank: user.current_rank || 'Novice Planter',
        tierLevel: user.tier_level || 1,
        stats: {
          farmsManaged: user.farms_managed_count || 0,
          ordersCompleted: user.total_orders_completed || 0,
          highestScore: user.highest_score || 0
        }
      }
    });
  });
});

// 4. Draft Endpoint Penyimpanan Skor Akhir Match
app.post('/api/score/save', (req, res) => {
  res.status(501).json({
    message: 'Endpoint /api/score/save belum diimplementasikan'
  });
});

// 5. Draft Endpoint Leaderboard (Top Skor)
app.get('/api/leaderboard', (req, res) => {
  res.status(501).json({
    message: 'Endpoint /api/leaderboard belum diimplementasikan'
  });
});

// ==========================================
// Jalankan Server
// ==========================================
app.listen(PORT, () => {
  console.log('=================================');
  console.log('  Server Game Backend Berjalan!  ');
  console.log(`  URL: http://localhost:${PORT}   `);
  console.log('=================================');
});
