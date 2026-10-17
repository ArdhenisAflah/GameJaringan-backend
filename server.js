// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');

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

// 2. Draft Endpoint Registrasi Akun Player Baru
app.post('/api/register', (req, res) => {
  res.status(501).json({
    message: 'Endpoint /api/register belum diimplementasikan'
  });
});

// 3. Draft Endpoint Autentikasi / Login Player
app.post('/api/login', (req, res) => {
  res.status(501).json({
    message: 'Endpoint /api/login belum diimplementasikan'
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
