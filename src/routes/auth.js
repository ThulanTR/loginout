const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { generateToken, authenticateToken } = require('../auth');

// Giriş Yap (POST /api/auth/login)
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Kullanıcı adı ve şifre gereklidir.'
    });
  }

  try {
    const stmt = db.prepare('SELECT * FROM admins WHERE username = ?');
    const admin = stmt.get(username.trim());

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Kullanıcı adı veya şifre hatalı!'
      });
    }

    const isMatch = bcrypt.compareSync(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Kullanıcı adı veya şifre hatalı!'
      });
    }

    const token = generateToken({
      id: admin.id,
      username: admin.username,
      fullName: admin.full_name
    });

    res.json({
      success: true,
      message: 'Giriş başarılı. Yönlendiriliyorsunuz...',
      token,
      user: {
        id: admin.id,
        username: admin.username,
        fullName: admin.full_name
      }
    });
  } catch (error) {
    console.error('Giriş hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası meydana geldi.'
    });
  }
});

// Oturum Doğrulama (GET /api/auth/verify)
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Şifre Değiştirme (POST /api/auth/change-password)
router.post('/change-password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Mevcut şifre ve yeni şifre gereklidir.'
    });
  }

  if (newPassword.length < 5) {
    return res.status(400).json({
      success: false,
      message: 'Yeni şifre en az 5 karakter olmalıdır.'
    });
  }

  try {
    const stmt = db.prepare('SELECT * FROM admins WHERE id = ?');
    const admin = stmt.get(req.user.id);

    if (!admin || !bcrypt.compareSync(currentPassword, admin.password_hash)) {
      return res.status(400).json({
        success: false,
        message: 'Mevcut şifreniz hatalı.'
      });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    const updateStmt = db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?');
    updateStmt.run(newHash, req.user.id);

    res.json({
      success: true,
      message: 'Şifreniz başarıyla güncellendi.'
    });
  } catch (error) {
    console.error('Şifre değiştirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Şifre güncellenirken bir hata oluştu.'
    });
  }
});

// Şifre Kurtarma (.env ADMIN_RECOVERY_CODE ile)
router.post('/recover-password', (req, res) => {
  const { recoveryCode, newPassword } = req.body;

  if (!recoveryCode || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Kurtarma kodu ve yeni şifre gereklidir.'
    });
  }

  const cleanCode = String(recoveryCode).trim();
  const cleanPass = String(newPassword).trim();
  const expectedCode = (process.env.ADMIN_RECOVERY_CODE || 'kurtarma2026').trim();

  if (!expectedCode || cleanCode !== expectedCode) {
    return res.status(400).json({
      success: false,
      message: 'Kurtarma kodu hatalı!'
    });
  }

  if (cleanPass.length < 5) {
    return res.status(400).json({
      success: false,
      message: 'Yeni şifre en az 5 karakter olmalıdır.'
    });
  }

  try {
    const admin = db.prepare('SELECT id, username FROM admins ORDER BY id ASC LIMIT 1').get();

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Kayıtlı yönetici hesabı bulunamadı.'
      });
    }

    const newHash = bcrypt.hashSync(cleanPass, 10);
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(newHash, admin.id);

    res.json({
      success: true,
      message: 'Şifreniz başarıyla sıfırlandı. Yeni şifrenizle giriş yapabilirsiniz.'
    });
  } catch (error) {
    console.error('Şifre kurtarma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Şifre güncellenirken sunucu hatası oluştu.'
    });
  }
});

module.exports = router;
