const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'giriscikis-secret-token-key-2026-secure';

// JWT Token oluşturma
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// Token doğrulama ara katmanı (Middleware)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.query.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Oturum bulunamadı. Lütfen yönetici girişi yapınız.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Oturum süresi dolmuş veya geçersiz token. Lütfen tekrar giriş yapınız.'
    });
  }
}

module.exports = {
  generateToken,
  authenticateToken,
  JWT_SECRET
};
