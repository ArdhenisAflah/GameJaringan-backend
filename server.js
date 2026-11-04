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
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const deviceInfo = req.headers['user-agent'] || 'Unity Client';
    const ipAddress = req.ip || req.socket.remoteAddress || '';

    // Catat / sinkronisasi sesi aktif ke tabel user_sessions di database
    db.run(
      `INSERT INTO user_sessions (user_id, token, device_info, ip_address, is_active, expires_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [user.userId, token, deviceInfo, ipAddress, expiresAt],
      (sessionErr) => {
        if (sessionErr) {
          console.warn('⚠️ Gagal mencatat user_sessions di database:', sessionErr.message);
        }

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
      }
    );
  });
});

// ==========================================
// Session Management & Verification Endpoints
// ==========================================

// Middleware pembantu untuk mengekstrak Bearer token dari header
function extractBearerToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return authHeader;
}

// 3.1 Endpoint Verifikasi Sesi / Auto-Login (GET /api/auth/verify)
app.get('/api/auth/verify', (req, res) => {
  const token = extractBearerToken(req) || req.query.token;

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Token otentikasi tidak disediakan!'
    });
  }

  // 1. Verifikasi integritas & masa berlaku JWT
  jwt.verify(token, JWT_SECRET, (jwtErr, decoded) => {
    if (jwtErr) {
      return res.status(401).json({
        status: 'error',
        message: 'Sesi login telah kedaluwarsa atau token tidak valid. Silakan login kembali.',
        error: jwtErr.message
      });
    }

    const userId = decoded.userId;

    // 2. Cek status sesi di database user_sessions (opsional verifikasi revoke/active)
    db.get(
      'SELECT is_active FROM user_sessions WHERE token = ?',
      [token],
      (sessErr, sessionRecord) => {
        if (sessionRecord && sessionRecord.is_active === 0) {
          return res.status(401).json({
            status: 'error',
            message: 'Sesi ini telah di-logout dari perangkat lain.'
          });
        }

        // 3. Ambil data profil terkini dari database
        const query = `
          SELECT 
            u.id AS userId,
            u.username,
            p.nickname,
            p.farms_managed_count,
            p.total_orders_completed,
            p.highest_score,
            r.rank_name AS current_rank,
            r.tier_level
          FROM users u
          LEFT JOIN player_profiles p ON u.id = p.user_id
          LEFT JOIN farm_ranks r ON p.current_rank_id = r.id
          WHERE u.id = ?
        `;

        db.get(query, [userId], (dbErr, user) => {
          if (dbErr || !user) {
            return res.status(404).json({
              status: 'error',
              message: 'Akun user tidak ditemukan di database.'
            });
          }

          return res.status(200).json({
            status: 'success',
            message: 'Sesi valid! Selamat datang kembali di Eden Farm.',
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
      }
    );
  });
});

// 3.2 Endpoint Logout / Hapus Sesi (POST /api/auth/logout)
app.post('/api/auth/logout', (req, res) => {
  const token = extractBearerToken(req) || req.body.token;

  if (!token) {
    return res.status(200).json({
      status: 'success',
      message: 'Logout berhasil (lokal).'
    });
  }

  // Nonaktifkan sesi di database
  db.run(
    'UPDATE user_sessions SET is_active = 0 WHERE token = ?',
    [token],
    (err) => {
      if (err) {
        console.warn('⚠️ Gagal menonaktifkan user_sessions:', err.message);
      }
      return res.status(200).json({
        status: 'success',
        message: 'Logout berhasil! Sesi perangkat telah dinonaktifkan.'
      });
    }
  );
});

// Helper function: Update farm_rank otomatis berdasarkan akumulasi total_orders_completed
function updatePlayerRankTier(userId) {
  const profileQuery = `
    SELECT total_orders_completed 
    FROM player_profiles 
    WHERE user_id = ?
  `;

  db.get(profileQuery, [userId], (err, profile) => {
    if (err || !profile) return;

    // Cari tier tertinggi yang syarat min_orders_required <= total_orders_completed
    const rankQuery = `
      SELECT id 
      FROM farm_ranks 
      WHERE min_orders_required <= ? 
      ORDER BY tier_level DESC 
      LIMIT 1
    `;

    db.get(rankQuery, [profile.total_orders_completed || 0], (rankErr, rank) => {
      if (rankErr || !rank) return;

      db.run(
        'UPDATE player_profiles SET current_rank_id = ? WHERE user_id = ?',
        [rank.id, userId]
      );
    });
  });
}

// ==========================================
// Score Management Endpoints
// ==========================================

// 4. Update / Simpan Skor Match per User Id (POST /api/score/save atau PUT /api/score/user/:userId)
const handleSaveOrUpdateScore = (req, res) => {
  const targetUserId = parseInt(req.params.userId || req.body.userId, 10);
  const { score, ordersCompleted, ordersFailed, cropsHarvested, ordersLoaded, sessionId } = req.body;

  if (isNaN(targetUserId)) {
    return res.status(400).json({
      status: 'error',
      message: 'userId harus berupa angka numerik yang valid!'
    });
  }

  const numericScore = typeof score === 'number' ? score : parseInt(score, 10);
  if (isNaN(numericScore)) {
    return res.status(400).json({
      status: 'error',
      message: 'score harus berupa angka numerik yang valid!'
    });
  }

  const cleanOrdersCompleted = parseInt(ordersCompleted, 10) || 0;
  const cleanOrdersFailed = parseInt(ordersFailed, 10) || 0;
  const cleanCropsHarvested = parseInt(cropsHarvested, 10) || 0;
  const cleanOrdersLoaded = parseInt(ordersLoaded, 10) || 0;
  const cleanSessionId = sessionId ? String(sessionId) : null;

  // 1. Pastikan user ada di database
  db.get('SELECT id FROM users WHERE id = ?', [targetUserId], (userErr, user) => {
    if (userErr) {
      return res.status(500).json({
        status: 'error',
        message: 'Terjadi kesalahan saat memeriksa user di database.',
        error: userErr.message
      });
    }

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: `User dengan ID ${targetUserId} tidak ditemukan!`
      });
    }

    // 2. Simpan record perolehan skor ke tabel 'scores' (Relasi 1:N)
    const insertScoreSql = `
      INSERT INTO scores (user_id, session_id, individual_score, crops_harvested, orders_loaded)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.run(
      insertScoreSql,
      [targetUserId, cleanSessionId, numericScore, cleanCropsHarvested, cleanOrdersLoaded],
      function (scoreErr) {
        if (scoreErr) {
          return res.status(500).json({
            status: 'error',
            message: 'Gagal mencatat riwayat skor match.',
            error: scoreErr.message
          });
        }

        const scoreRecordId = this.lastID;

        // 3. Update agregat profil pemain (farms_managed_count + 1, total_orders_completed, highest_score)
        const updateProfileSql = `
          UPDATE player_profiles
          SET 
            farms_managed_count = farms_managed_count + 1,
            total_orders_completed = total_orders_completed + ?,
            highest_score = CASE WHEN ? > highest_score THEN ? ELSE highest_score END
          WHERE user_id = ?
        `;

        db.run(
          updateProfileSql,
          [cleanOrdersCompleted, numericScore, numericScore, targetUserId],
          (updateErr) => {
            if (updateErr) {
              console.error('Peringatan: Gagal memperbarui statistik player_profiles:', updateErr.message);
            }

            // Evaluasi kenaikan tier/rank otomatis
            updatePlayerRankTier(targetUserId);

            // 4. Ambil statistik profil ter-update untuk dikembalikan ke game client
            const getUpdatedQuery = `
              SELECT 
                p.user_id AS userId,
                u.username,
                p.nickname,
                p.highest_score AS highestScore,
                p.farms_managed_count AS farmsManaged,
                p.total_orders_completed AS totalOrdersCompleted,
                r.rank_name AS currentRank,
                r.tier_level AS tierLevel
              FROM player_profiles p
              JOIN users u ON p.user_id = u.id
              LEFT JOIN farm_ranks r ON p.current_rank_id = r.id
              WHERE p.user_id = ?
            `;

            db.get(getUpdatedQuery, [targetUserId], (fetchErr, updatedData) => {
              return res.status(200).json({
                status: 'success',
                message: 'Skor berhasil diperbarui dan disimpan!',
                scoreRecordId: scoreRecordId,
                addedScore: numericScore,
                playerStats: updatedData || {
                  userId: targetUserId,
                  score: numericScore
                }
              });
            });
          }
        );
      }
    );
  });
};

// Route kompatibel dengan spesifikasi Modul 8 & RESTful parameter
app.post('/api/score/save', handleSaveOrUpdateScore);
app.put('/api/score/user/:userId', handleSaveOrUpdateScore);

// 5. View Score & Statistik per User ID (GET /api/score/user/:userId)
app.get('/api/score/user/:userId', (req, res) => {
  const targetUserId = parseInt(req.params.userId, 10);

  if (isNaN(targetUserId)) {
    return res.status(400).json({
      status: 'error',
      message: 'userId harus berupa angka integer!'
    });
  }

  const query = `
    SELECT 
      u.id AS userId,
      u.username,
      p.nickname,
      p.highest_score AS highestScore,
      p.farms_managed_count AS farmsManaged,
      p.total_orders_completed AS totalOrdersCompleted,
      r.rank_name AS currentRank,
      r.tier_level AS tierLevel,
      r.badge_icon_url AS badgeIconUrl,
      (SELECT COUNT(*) FROM scores WHERE user_id = u.id) AS totalMatchesPlayed,
      (SELECT COALESCE(SUM(individual_score), 0) FROM scores WHERE user_id = u.id) AS cumulativeScore
    FROM users u
    LEFT JOIN player_profiles p ON u.id = p.user_id
    LEFT JOIN farm_ranks r ON p.current_rank_id = r.id
    WHERE u.id = ?
  `;

  db.get(query, [targetUserId], (err, row) => {
    if (err) {
      return res.status(500).json({
        status: 'error',
        message: 'Terjadi kesalahan pada database.',
        error: err.message
      });
    }

    if (!row) {
      return res.status(404).json({
        status: 'error',
        message: `Pemain dengan ID ${targetUserId} tidak ditemukan!`
      });
    }

    // Ambil juga 5 riwayat match terakhir pemain
    const matchHistoryQuery = `
      SELECT 
        id,
        session_id AS sessionId,
        individual_score AS score,
        crops_harvested AS cropsHarvested,
        orders_loaded AS ordersLoaded,
        recorded_at AS recordedAt
      FROM scores
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 5
    `;

    db.all(matchHistoryQuery, [targetUserId], (histErr, historyRows) => {
      return res.status(200).json({
        status: 'success',
        message: `Data skor pemain ${row.nickname || row.username} berhasil diambil.`,
        data: {
          userId: row.userId,
          username: row.username,
          nickname: row.nickname || row.username,
          highestScore: row.highestScore || 0,
          cumulativeScore: row.cumulativeScore || 0,
          rank: row.currentRank || 'Novice Planter',
          tierLevel: row.tierLevel || 1,
          badgeIconUrl: row.badgeIconUrl,
          stats: {
            farmsManaged: row.farmsManaged || 0,
            totalOrdersCompleted: row.totalOrdersCompleted || 0,
            totalMatchesPlayed: row.totalMatchesPlayed || 0
          },
          recentMatches: historyRows || []
        }
      });
    });
  });
});

// 6. View Scoreboard / Leaderboard Top 10 (GET /api/leaderboard)
app.get('/api/leaderboard', (req, res) => {
  const query = `
    SELECT 
      u.id AS userId,
      u.username,
      COALESCE(p.nickname, u.username) AS nickname,
      COALESCE(p.highest_score, 0) AS score,
      COALESCE(p.total_orders_completed, 0) AS ordersCompleted,
      COALESCE(p.farms_managed_count, 0) AS farmsManaged,
      COALESCE(r.rank_name, 'Novice Planter') AS rank,
      COALESCE(r.tier_level, 1) AS tierLevel,
      r.badge_icon_url AS badgeIconUrl
    FROM users u
    JOIN player_profiles p ON u.id = p.user_id
    LEFT JOIN farm_ranks r ON p.current_rank_id = r.id
    ORDER BY p.highest_score DESC, p.total_orders_completed DESC
    LIMIT 10
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        status: 'error',
        message: 'Gagal memuat papan peringkat (leaderboard).',
        error: err.message
      });
    }

    // Tambahkan posisi ranking numerik (1, 2, 3, ...)
    const rankedData = (rows || []).map((item, index) => ({
      position: index + 1,
      userId: item.userId,
      username: item.username,
      nickname: item.nickname,
      score: item.score,
      rank: item.rank,
      tierLevel: item.tierLevel,
      badgeIconUrl: item.badgeIconUrl,
      stats: {
        ordersCompleted: item.ordersCompleted,
        farmsManaged: item.farmsManaged
      }
    }));

    return res.status(200).json({
      status: 'success',
      message: 'Leaderboard Top 10 Eden Farm berhasil diambil.',
      totalEntries: rankedData.length,
      data: rankedData
    });
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
