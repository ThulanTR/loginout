const express = require('express');
const path = require('node:path');
const cors = require('cors');
const { initDatabase } = require('./src/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Veritabanını başlat
initDatabase();

// Ara Katmanlar (Middlewares)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statik Dosyalar (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

// API Rotaları
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/shifts', require('./src/routes/shifts'));
app.use('/api/payments', require('./src/routes/payments'));
app.use('/api/stats', require('./src/routes/stats'));

// Sayfa Yönlendirmeleri
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Bilinmeyen rotaları ana sayfaya yönlendir
app.get('*', (req, res) => {
  res.redirect('/');
});

// Sunucuyu Başlat
app.listen(PORT, () => {
  console.log('====================================================');
  console.log('🚀 PERSONEL TAKİP VE FİNANS YÖNETİM SİSTEMİ ÇALIŞIYOR');
  console.log('====================================================');
  console.log(`🌐 Çalışan Portali:  http://localhost:${PORT}`);
  console.log(`🔒 Yönetici Paneli:  http://localhost:${PORT}/admin`);
  console.log(`🔑 Varsayılan Yönetici Şifresi: admin123`);
  console.log('====================================================');
});
