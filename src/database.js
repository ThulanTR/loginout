const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');

// Veritabanı klasörünü güvenceye al (Dinamik DATA_DIR veya varsayılan ./data)
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'giriscikis.db');
const db = new DatabaseSync(dbPath);

// WAL modu, busy timeout ve performans ayarları
try {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
} catch (pragmaErr) {
  console.warn('⚠️ SQLite PRAGMA yapılandırma uyarısı:', pragmaErr.message);
}

// Tabloları oluştur
function initDatabase() {
  db.exec(`
    -- Personel Giriş-Çıkış / Vardiya Kayıtları Tablosu
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_name TEXT NOT NULL,
      workplace TEXT DEFAULT '',
      entry_time TEXT NOT NULL,
      exit_time TEXT,
      duration_minutes INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      entry_latitude REAL,
      entry_longitude REAL,
      checkout_latitude REAL,
      checkout_longitude REAL,
      checkout_location_name TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Finans ve Ödemeler Tablosu (Gelir & Gider)
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'expense',
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      recipient TEXT NOT NULL,
      category TEXT NOT NULL,
      payment_method TEXT DEFAULT 'Nakit',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Yönetici Kullanıcıları Tablosu
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Tablo Migrasyonu: Var olan veritabanı dosyalarında kolon kontrolü ve ekleme
  try {
    const shiftCols = db.prepare("PRAGMA table_info(shifts)").all();
    const hasStatus = shiftCols.some(c => c.name === 'status');
    if (!hasStatus) {
      db.exec("ALTER TABLE shifts ADD COLUMN status TEXT DEFAULT 'completed'");
      db.exec("UPDATE shifts SET status = CASE WHEN exit_time IS NULL OR exit_time = '' THEN 'active' ELSE 'completed' END");
      console.log('✅ shifts tablosuna status kolonu eklendi ve mevcut veriler güncellendi.');
    }

    const hasLat = shiftCols.some(c => c.name === 'entry_latitude');
    if (!hasLat) {
      db.exec("ALTER TABLE shifts ADD COLUMN entry_latitude REAL");
      console.log('✅ shifts tablosuna entry_latitude kolonu eklendi.');
    }

    const hasLng = shiftCols.some(c => c.name === 'entry_longitude');
    if (!hasLng) {
      db.exec("ALTER TABLE shifts ADD COLUMN entry_longitude REAL");
      console.log('✅ shifts tablosuna entry_longitude kolonu eklendi.');
    }

    const hasCheckoutLat = shiftCols.some(c => c.name === 'checkout_latitude');
    if (!hasCheckoutLat) {
      db.exec("ALTER TABLE shifts ADD COLUMN checkout_latitude REAL");
      console.log('✅ shifts tablosuna checkout_latitude kolonu eklendi.');
    }

    const hasCheckoutLng = shiftCols.some(c => c.name === 'checkout_longitude');
    if (!hasCheckoutLng) {
      db.exec("ALTER TABLE shifts ADD COLUMN checkout_longitude REAL");
      console.log('✅ shifts tablosuna checkout_longitude kolonu eklendi.');
    }

    const hasCheckoutLocName = shiftCols.some(c => c.name === 'checkout_location_name');
    if (!hasCheckoutLocName) {
      db.exec("ALTER TABLE shifts ADD COLUMN checkout_location_name TEXT");
      console.log('✅ shifts tablosuna checkout_location_name kolonu eklendi.');
    }

    // payments tablosu type kolonu kontrolü
    const paymentCols = db.prepare("PRAGMA table_info(payments)").all();
    const hasPaymentType = paymentCols.some(c => c.name === 'type');
    if (!hasPaymentType) {
      db.exec("ALTER TABLE payments ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'");
      console.log('✅ payments tablosuna type kolonu (income/expense) eklendi.');
    }

    // Aktif vardiyalarda saat dilimi (UTC ISO) düzeltmesi (Railway / Localhost uyumu)
    try {
      const activeRows = db.prepare("SELECT id, entry_time FROM shifts WHERE status = 'active' OR exit_time IS NULL").all();
      activeRows.forEach(row => {
        if (row.entry_time && !row.entry_time.endsWith('Z') && !row.entry_time.includes('+')) {
          const parsed = new Date(row.entry_time.includes('T') ? row.entry_time + 'Z' : row.entry_time.replace(' ', 'T') + 'Z');
          if (!isNaN(parsed.getTime())) {
            db.prepare("UPDATE shifts SET entry_time = ? WHERE id = ?").run(parsed.toISOString(), row.id);
            console.log(`✅ Açık vardiya #${row.id} entry_time UTC ISO formatına dönüştürüldü.`);
          }
        }
      });
    } catch (tzErr) {
      console.warn('Açık vardiya zaman dilimi kontrolü:', tzErr.message);
    }
  } catch (migErr) {
    console.error('Migrasyon kontrolü hatası:', migErr);
  }

  ensureAdminUserExists();
}

// Varsayılan yönetici kontrolü ve oluşturma (admin / admin123)
function ensureAdminUserExists() {
  const adminStmt = db.prepare('SELECT COUNT(*) as count FROM admins');
  const adminCount = adminStmt.get().count;

  if (adminCount === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    const insertAdmin = db.prepare(`
      INSERT INTO admins (username, password_hash, full_name)
      VALUES (?, ?, ?)
    `);
    insertAdmin.run('admin', hash, 'Sistem Yöneticisi');
    console.log('✅ Varsayılan yönetici oluşturuldu (Kullanıcı: admin, Şifre: admin123)');
  }
}

// Tüm sahte / örnek verileri temizleme fonksiyonu
function clearAllShiftAndPaymentData() {
  try {
    db.exec(`
      DELETE FROM shifts;
      DELETE FROM payments;
      DELETE FROM sqlite_sequence WHERE name IN ('shifts', 'payments');
    `);
    console.log('🧹 Tüm vardiya ve ödeme kayıtları temizlendi.');
  } catch (err) {
    console.warn('Veri temizleme uyarısı:', err.message);
  }
}

// İlk başlatma
initDatabase();

module.exports = {
  db,
  initDatabase,
  ensureAdminUserExists,
  clearAllShiftAndPaymentData
};

