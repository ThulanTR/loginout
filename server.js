const express = require('express');
const path = require('node:path');
const cors = require('cors');
const helmet = require('helmet');
const { initDatabase } = require('./src/database');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Veritabanını başlat
initDatabase();

// Ara Katmanlar (Middlewares) & Güvenlik Başlıkları
app.use(helmet({ contentSecurityPolicy: false }));
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
app.listen(PORT, HOST, () => {
  console.log('====================================================');
  console.log('🚀 PERSONEL TAKİP VE FİNANS YÖNETİM SİSTEMİ ÇALIŞIYOR');
  console.log('====================================================');
  console.log(`🌐 Host & Port:      http://${HOST}:${PORT}`);
  console.log(`🔒 Yönetici Paneli:  http://${HOST}:${PORT}/admin`);
  console.log(`🔑 Varsayılan Yönetici Şifresi: admin123`);
  console.log('====================================================');
});

