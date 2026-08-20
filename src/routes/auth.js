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

// Kurtarma Anahtarı ile Şifre Sıfırlama (POST /api/auth/reset-password-recovery)
router.post('/reset-password-recovery', (req, res) => {
  const { username, recoveryKey, newPassword } = req.body;

  if (!username || !recoveryKey || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Kullanıcı adı, kurtarma şifresi ve yeni şifre alanları zorunludur.'
    });
  }

  const cleanUser = String(username).trim();
  const cleanKey = String(recoveryKey).trim();
  const cleanPass = String(newPassword).trim();

  if (cleanPass.length < 5) {
    return res.status(400).json({
      success: false,
      message: 'Yeni şifre en az 5 karakter olmalıdır.'
    });
  }

  try {
    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(cleanUser);

    if (!admin || !admin.recovery_key_hash) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı adı veya Kurtarma Şifresi (Master Key) hatalı!'
      });
    }

    const isMatch = bcrypt.compareSync(cleanKey, admin.recovery_key_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Kurtarma Şifresi (Master Key) hatalı! Lütfen doğru anahtarı girdiğinizden emin olun.'
      });
    }

    const newHash = bcrypt.hashSync(cleanPass, 10);
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(newHash, admin.id);

    res.json({
      success: true,
      message: 'Şifreniz başarıyla sıfırlandı. Yeni şifrenizle giriş yapabilirsiniz.'
    });
  } catch (error) {
    console.error('Kurtarma şifresi sıfırlama hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Şifre sıfırlanırken sunucu hatası oluştu.'
    });
  }
});

// Kurtarma Şifresi Güncelleme (POST /api/auth/change-recovery-key)
router.post('/change-recovery-key', authenticateToken, (req, res) => {
  const { currentPassword, newRecoveryKey } = req.body;

  if (!currentPassword || !newRecoveryKey) {
    return res.status(400).json({
      success: false,
      message: 'Mevcut hesap şifreniz ve yeni kurtarma şifresi zorunludur.'
    });
  }

  const cleanKey = String(newRecoveryKey).trim();
  if (cleanKey.length < 5) {
    return res.status(400).json({
      success: false,
      message: 'Kurtarma şifresi en az 5 karakter olmalıdır.'
    });
  }

  try {
    const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.user.id);

    if (!admin || !bcrypt.compareSync(currentPassword, admin.password_hash)) {
      return res.status(400).json({
        success: false,
        message: 'Mevcut hesap şifreniz hatalı.'
      });
    }

    const newRecoveryHash = bcrypt.hashSync(cleanKey, 10);
    db.prepare('UPDATE admins SET recovery_key_hash = ? WHERE id = ?').run(newRecoveryHash, admin.id);

    res.json({
      success: true,
      message: 'Kurtarma şifreniz (Master Key) başarıyla güncellendi. Lütfen bu şifreyi güvenli bir yerde saklayınız.'
    });
  } catch (error) {
    console.error('Kurtarma şifresi değiştirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Kurtarma şifresi güncellenirken hata oluştu.'
    });
  }
});

module.exports = router;
