const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Lokasi file database lokal SQLite
const DB_PATH = path.resolve(__dirname, 'game.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Gagal terhubung ke database SQLite:', err.message);
  } else {
    console.log('✅ Terhubung ke database SQLite: game.db');
    initDatabase();
  }
});

/**
 * Inisialisasi skema tabel berdasarkan dokumen ERD (Eden Farm 3NF Architecture):
 * 1. USERS: Kredensial akun otentikasi
 * 2. FARM_RANKS: Master data tier leaderboard
 * 3. PLAYER_PROFILES: Profil publik, statistik progres & relasi 1:1 ke USERS
 * 4. GAME_SESSIONS: Sesi permainan multiplayer (Lobby/Room FishNet/UGS)
 * 5. SCORES: Riwayat skor dan kontribusi individu per sesi permainan
 */
function initDatabase() {
  db.serialize(() => {
    // Aktifkan Foreign Keys di SQLite (wajib diaktifkan manual per koneksi)
    db.run('PRAGMA foreign_keys = ON;');

    // 1. Tabel USERS
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Tabel FARM_RANKS (Master Lookup Data)
    db.run(`
      CREATE TABLE IF NOT EXISTS farm_ranks (
        id INTEGER PRIMARY KEY,
        rank_name TEXT NOT NULL,
        min_orders_required INTEGER NOT NULL,
        tier_level INTEGER NOT NULL,
        badge_icon_url TEXT
      )
    `);

    // Isi seed data default untuk FARM_RANKS jika tabel masih kosong
    db.get('SELECT COUNT(*) AS count FROM farm_ranks', (err, row) => {
      if (!err && row && row.count === 0) {
        const stmt = db.prepare(`
          INSERT INTO farm_ranks (id, rank_name, min_orders_required, tier_level, badge_icon_url)
          VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(1, 'Novice Planter', 0, 1, 'badges/novice.png');
        stmt.run(2, 'Apprentice Farmer', 25, 2, 'badges/apprentice.png');
        stmt.run(3, 'Master Harvester', 100, 3, 'badges/master.png');
        stmt.run(4, 'Eden Legend', 250, 4, 'badges/legend.png');
        stmt.finalize(() => {
          console.log('🌱 Seed data FARM_RANKS berhasil diinisialisasi.');
        });
      }
    });

    // 3. Tabel PLAYER_PROFILES (Relasi 1:1 ke USERS, Relasi 1:N ke FARM_RANKS)
    db.run(`
      CREATE TABLE IF NOT EXISTS player_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        current_rank_id INTEGER DEFAULT 1,
        nickname TEXT NOT NULL,
        birth_date TEXT,
        farms_managed_count INTEGER DEFAULT 0,
        total_orders_completed INTEGER DEFAULT 0,
        highest_score INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (current_rank_id) REFERENCES farm_ranks(id) ON DELETE SET DEFAULT
      )
    `);

    // 4. Tabel GAME_SESSIONS (Sesi room/lobby gameplay bersama)
    db.run(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id TEXT PRIMARY KEY,
        lobby_id TEXT,
        match_result TEXT NOT NULL,
        total_orders_delivered INTEGER DEFAULT 0,
        total_orders_failed INTEGER DEFAULT 0,
        duration_seconds INTEGER DEFAULT 0,
        started_at DATETIME NOT NULL,
        ended_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Tabel SCORES (Relasi 1:N ke USERS, Relasi 1:N ke GAME_SESSIONS)
    db.run(`
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_id TEXT,
        individual_score INTEGER DEFAULT 0,
        crops_harvested INTEGER DEFAULT 0,
        orders_loaded INTEGER DEFAULT 0,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE SET NULL
      )
    `);

    // 6. Tabel USER_SESSIONS (Penyimpanan Sesi / Token Aktif Pemain untuk Validasi & Device Tracking)
    db.run(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        device_info TEXT,
        ip_address TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  });
}

module.exports = db;