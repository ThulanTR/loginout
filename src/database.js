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
      workplace TEXT NOT NULL,
      entry_time TEXT NOT NULL,
      exit_time TEXT,
      duration_minutes INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      entry_latitude REAL,
      entry_longitude REAL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- Finans ve Ödemeler Tablosu
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  seedDataIfEmpty();
}

// Varsayılan yönetici ve örnek gerçekçi veriler
function seedDataIfEmpty() {
  // Yönetici kontrolü
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

  // Örnek Vardiya Verileri kontrolü
  const shiftStmt = db.prepare('SELECT COUNT(*) as count FROM shifts');
  const shiftCount = shiftStmt.get().count;

  if (shiftCount === 0) {
    const insertShift = db.prepare(`
      INSERT INTO shifts (employee_name, workplace, entry_time, exit_time, duration_minutes, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);

    const now = new Date();
    const formatDate = (daysAgo, hours, minutes) => {
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      d.setHours(hours, minutes, 0, 0);
      return d.toISOString().slice(0, 16);
    };

    const sampleShifts = [
      {
        name: 'Ahmet Yılmaz',
        place: 'Merkez Şantiye - Blok A',
        entry: formatDate(0, 8, 30),
        exit: formatDate(0, 17, 30),
        duration: 540,
        status: 'completed',
        notes: 'Temel beton dökümü ve kalıp kontrolü tamamlandı.'
      },
      {
        name: 'Mehmet Demir',
        place: 'Kuzey Projesi',
        entry: formatDate(0, 9, 0),
        exit: formatDate(0, 18, 0),
        duration: 540,
        status: 'completed',
        notes: 'Elektrik tesisatı döşendi ve kablo kanalları çekildi.'
      },
      {
        name: 'Ayşe Kaya',
        place: 'Merkez Ofis',
        entry: formatDate(0, 8, 45),
        exit: formatDate(0, 17, 45),
        duration: 540,
        status: 'completed',
        notes: 'Haftalık malzeme siparişleri ve hakediş kontrolleri yapıldı.'
      },
      {
        name: 'Mustafa Çelik',
        place: 'Güney Depo',
        entry: formatDate(1, 8, 0),
        exit: formatDate(1, 16, 30),
        duration: 510,
        status: 'completed',
        notes: 'Gelen hammadde sayımı ve sevkiyat organizasyonu.'
      },
      {
        name: 'Emre Şahin',
        place: 'Merkez Şantiye - Blok B',
        entry: formatDate(1, 8, 15),
        exit: formatDate(1, 18, 45),
        duration: 630,
        status: 'completed',
        notes: 'Duvar örme ve sıva hazırlık işlemleri tamamlandı.'
      },
      {
        name: 'Fatma Yıldız',
        place: 'Merkez Ofis',
        entry: formatDate(2, 9, 0),
        exit: formatDate(2, 18, 0),
        duration: 540,
        status: 'completed',
        notes: 'Müşteri sözleşmeleri ve personel bordroları düzenlendi.'
      },
      {
        name: 'Burak Koç',
        place: 'Kuzey Projesi',
        entry: formatDate(2, 8, 30),
        exit: formatDate(2, 17, 0),
        duration: 510,
        status: 'completed',
        notes: 'Sıhhi tesisat borulama ve basınç testleri yapıldı.'
      },
      {
        name: 'Ahmet Yılmaz',
        place: 'Merkez Şantiye - Blok A',
        entry: formatDate(3, 8, 0),
        exit: formatDate(3, 17, 30),
        duration: 570,
        status: 'completed',
        notes: 'Demir bağlama ve zemin kotlama çalışmaları.'
      }
    ];

    sampleShifts.forEach(s => {
      insertShift.run(s.name, s.place, s.entry, s.exit, s.duration, s.status || 'completed', s.notes);
    });
    console.log('✅ Örnek personel giriş-çıkış kayıtları oluşturuldu.');
  }

  // Örnek Finans / Ödeme Verileri kontrolü
  const payStmt = db.prepare('SELECT COUNT(*) as count FROM payments');
  const payCount = payStmt.get().count;

  if (payCount === 0) {
    const insertPay = db.prepare(`
      INSERT INTO payments (payment_date, amount, recipient, category, payment_method, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);

    const formatDateOnly = (daysAgo) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().slice(0, 10);
    };

    const samplePayments = [
      {
        date: formatDateOnly(1),
        amount: 28500.0,
        recipient: 'Ahmet Yılmaz',
        category: 'Maaş',
        method: 'Banka Havalesi',
        notes: 'Ağustos ayı hak ediş / maaş ödemesi'
      },
      {
        date: formatDateOnly(2),
        amount: 14200.0,
        recipient: 'Özdemir Yapı Market Ltd.',
        category: 'Malzeme',
        method: 'Banka Havalesi',
        notes: 'Çimento, demir bağ teli ve harç katkı malzemeleri alımı'
      },
      {
        date: formatDateOnly(3),
        amount: 5000.0,
        recipient: 'Mehmet Demir',
        category: 'Maaş',
        method: 'Nakit',
        notes: 'Haftalık acil avans ödemesi'
      },
      {
        date: formatDateOnly(4),
        amount: 3250.0,
        recipient: 'Lezzet Catering & Yemek',
        category: 'Diğer',
        method: 'Nakit',
        notes: 'Şantiye personeli haftalık öğle yemeği bedeli'
      },
      {
        date: formatDateOnly(6),
        amount: 7500.0,
        recipient: 'Akaryakıt İstasyonu',
        category: 'Malzeme',
        method: 'Banka Havalesi',
        notes: 'Şantiye kepçe ve servis araçları mazot ikmali'
      },
      {
        date: formatDateOnly(8),
        amount: 26000.0,
        recipient: 'Mustafa Çelik',
        category: 'Maaş',
        method: 'Banka Havalesi',
        notes: 'Aylık hakediş ve mesai ödemesi'
      },
      {
        date: formatDateOnly(10),
        amount: 4500.0,
        recipient: 'Emre Şahin',
        category: 'Diğer',
        method: 'Nakit',
        notes: 'Erken teslim ve performans başarı primi'
      }
    ];

    samplePayments.forEach(p => {
      insertPay.run(p.date, p.amount, p.recipient, p.category, p.method, p.notes);
    });
    console.log('✅ Örnek finans ve ödeme kayıtları oluşturuldu.');
  }
}

// İlk başlatma
initDatabase();

module.exports = {
  db,
  initDatabase
};
