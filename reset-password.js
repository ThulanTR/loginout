#!/usr/bin/env node
/**
 * ============================================================================
 * PERSONEL TAKİP VE FİNANS YÖNETİM SİSTEMİ - ŞİFRE SIFIRLAMA ARACI
 * ============================================================================
 * Kullanım:
 *   node reset-password.js <YeniŞifre>
 *   node reset-password.js <KullanıcıAdı> <YeniŞifre>
 *   node reset-password.js --recovery <YeniKurtarmaŞifresi>
 * ============================================================================
 */

const bcrypt = require('bcryptjs');
const path = require('node:path');
const fs = require('node:fs');

// Veritabanı bağlantısını başlat
const { db, initDatabase } = require('./src/database');
initDatabase();

const args = process.argv.slice(2);

console.log('====================================================');
console.log('🔒 YÖNETİCİ ŞİFRE SIFIRLAMA ARACI');
console.log('====================================================');

if (args.length === 0) {
  console.error('\n❌ HATA: Yeni şifre parametresi belirtilmedi!\n');
  console.log('📖 KULLANIM REHBERİ:');
  console.log('  1. Varsayılan yönetici şifresini değiştirmek için:');
  console.log('     node reset-password.js YeniSifre123\n');
  console.log('  2. Belirli bir kullanıcı adının şifresini değiştirmek için:');
  console.log('     node reset-password.js admin YeniSifre123\n');
  console.log('  3. Kurtarma anahtarını (Master Key) sıfırlamak için:');
  console.log('     node reset-password.js --recovery YeniKurtarma123\n');
  process.exit(1);
}

// 1. Kurtarma Anahtarı Sıfırlama Modu
if (args[0] === '--recovery') {
  const newRecoveryKey = args[1];
  if (!newRecoveryKey || newRecoveryKey.trim().length < 5) {
    console.error('\n❌ HATA: Kurtarma şifresi en az 5 karakter uzunluğunda olmalıdır!\n');
    process.exit(1);
  }

  const cleanKey = newRecoveryKey.trim();
  const recoveryHash = bcrypt.hashSync(cleanKey, 10);

  const admin = db.prepare('SELECT id, username FROM admins ORDER BY id ASC LIMIT 1').get();
  if (!admin) {
    console.error('\n❌ HATA: Veritabanında kayıtlı yönetici bulunamadı.\n');
    process.exit(1);
  }

  db.prepare('UPDATE admins SET recovery_key_hash = ? WHERE id = ?').run(recoveryHash, admin.id);

  console.log('\n✅ BAŞARILI!');
  console.log(`👤 Güncellenen Kullanıcı: ${admin.username}`);
  console.log(`🛡️  Yeni Kurtarma Şifresi: ${cleanKey}`);
  console.log('\nℹ️  Bu kurtarma şifresini güvenli bir yerde saklayınız.');
  console.log('====================================================\n');
  process.exit(0);
}

// 2. Normal Şifre Sıfırlama Modu
let targetUsername = 'admin';
let newPassword = '';

if (args.length === 1) {
  newPassword = args[0];
} else {
  targetUsername = args[0];
  newPassword = args[1];
}

if (!newPassword || newPassword.trim().length < 5) {
  console.error('\n❌ HATA: Yeni şifre en az 5 karakter uzunluğunda olmalıdır!\n');
  process.exit(1);
}

const cleanPass = newPassword.trim();
const passwordHash = bcrypt.hashSync(cleanPass, 10);

// Admin kullanıcısını ara
let admin = db.prepare('SELECT id, username, full_name FROM admins WHERE username = ?').get(targetUsername);

if (!admin) {
  // Eğer belirtilen kullanıcı adı bulunamadıysa ilk yöneticiyi almayı dene
  const firstAdmin = db.prepare('SELECT id, username, full_name FROM admins ORDER BY id ASC LIMIT 1').get();
  if (firstAdmin && args.length === 1) {
    admin = firstAdmin;
  } else {
    // Hiç yönetici yoksa oluştur
    const defaultRecoveryHash = bcrypt.hashSync('admin-kurtarma-2026', 10);
    const insertStmt = db.prepare(`
      INSERT INTO admins (username, password_hash, full_name, recovery_key_hash)
      VALUES (?, ?, ?, ?)
    `);
    insertStmt.run(targetUsername, passwordHash, 'Sistem Yöneticisi', defaultRecoveryHash);
    console.log('\n✅ BAŞARILI: Yönetici hesabı oluşturuldu ve şifresi tanımlandı!');
    console.log(`👤 Kullanıcı Adı:      ${targetUsername}`);
    console.log(`🔑 Yeni Şifre:         ${cleanPass}`);
    console.log(`🛡️  Kurtarma Şifresi:   admin-kurtarma-2026`);
    console.log('\n🌐 Giriş Yapmak İçin: http://localhost:3000');
    console.log('====================================================\n');
    process.exit(0);
  }
}

// Mevcut yöneticinin şifresini güncelle
db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(passwordHash, admin.id);

console.log('\n✅ ŞİFRE BAŞARIYLA SIFIRLANDI!');
console.log('----------------------------------------------------');
console.log(`👤 Kullanıcı Adı:      ${admin.username} (${admin.full_name || 'Yönetici'})`);
console.log(`🔑 Yeni Şifre:         ${cleanPass}`);
console.log('----------------------------------------------------');
console.log('🌐 Giriş Yapmak İçin: http://localhost:3000 veya /admin');
console.log('====================================================\n');
process.exit(0);
