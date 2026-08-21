const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticateToken } = require('../auth');

// Para birimi formatlama fonksiyonu (CAD$)
function formatCurrency(amount) {
  const formatted = new Intl.NumberFormat('en-CA', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
  return `CAD$ ${formatted}`;
}

// Yönetici: Tüm Ödeme Kayıtlarını Listele ve Filtrele (GET /api/payments)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { search, category, method, startDate, endDate, type } = req.query;

    let query = 'SELECT * FROM payments WHERE 1=1';
    const params = [];

    if (search && search.trim() !== '') {
      query += ' AND (recipient LIKE ? OR notes LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (type && (type === 'income' || type === 'expense')) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (category && category.trim() !== '') {
      query += ' AND category = ?';
      params.push(category.trim());
    }

    if (method && method.trim() !== '') {
      query += ' AND payment_method = ?';
      params.push(method.trim());
    }

    if (startDate && startDate.trim() !== '') {
      query += ' AND payment_date >= ?';
      params.push(startDate.trim());
    }

    if (endDate && endDate.trim() !== '') {
      query += ' AND payment_date <= ?';
      params.push(endDate.trim());
    }

    query += ' ORDER BY payment_date DESC, id DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    // Zenginleştirilmiş satırlar ve toplamlar
    const enrichedRows = rows.map(row => {
      const itemType = row.type === 'income' ? 'income' : 'expense';
      return {
        ...row,
        type: itemType,
        isIncome: itemType === 'income',
        amountFormatted: formatCurrency(row.amount)
      };
    });

    // Toplam Gelir ve Gider Hesaplama
    let totalIncome = 0;
    let totalExpense = 0;
    rows.forEach(r => {
      const amt = Number(r.amount) || 0;
      if (r.type === 'income') {
        totalIncome += amt;
      } else {
        totalExpense += amt;
      }
    });

    const netBalance = totalIncome - totalExpense;
    const totalAmount = rows.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    // Kategori bazlı toplamlar
    const categoryTotals = {};
    rows.forEach(r => {
      categoryTotals[r.category] = (categoryTotals[r.category] || 0) + Number(r.amount);
    });

    res.json({
      success: true,
      data: enrichedRows,
      count: enrichedRows.length,
      totalIncome,
      totalIncomeFormatted: formatCurrency(totalIncome),
      totalExpense,
      totalExpenseFormatted: formatCurrency(totalExpense),
      netBalance,
      netBalanceFormatted: formatCurrency(netBalance),
      totalAmount,
      totalAmountFormatted: formatCurrency(totalAmount),
      categoryTotals
    });
  } catch (error) {
    console.error('Ödeme listeleme hatası:', error);
    res.status(500).json({ success: false, message: 'Ödeme kayıtları alınamadı.' });
  }
});

// Yönetici: Yeni Ödeme Kaydı Ekle (POST /api/payments)
router.post('/', authenticateToken, (req, res) => {
  const { payment_date, amount, recipient, category, payment_method, notes, type } = req.body;

  if (!payment_date || amount === undefined || amount === null || !recipient || !category) {
    return res.status(400).json({
      success: false,
      message: 'Tarih, tutar, kişi/kurum ve kategori alanları zorunludur.'
    });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Lütfen geçerli bir ödeme tutarı giriniz (0 dan büyük).'
    });
  }

  const paymentType = (type === 'income') ? 'income' : 'expense';

  try {
    const stmt = db.prepare(`
      INSERT INTO payments (type, payment_date, amount, recipient, category, payment_method, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);

    const result = stmt.run(
      paymentType,
      payment_date.trim(),
      parsedAmount,
      recipient.trim(),
      category.trim(),
      payment_method ? payment_method.trim() : 'Nakit',
      notes ? notes.trim() : null
    );

    res.status(201).json({
      success: true,
      message: paymentType === 'income' ? 'Gelir (Alınan ödeme) kaydı başarıyla oluşturuldu.' : 'Gider (Yapılan ödeme) kaydı başarıyla oluşturuldu.',
      paymentId: result.lastInsertRowid,
      type: paymentType,
      amountFormatted: formatCurrency(parsedAmount)
    });
  } catch (error) {
    console.error('Ödeme ekleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Ödeme kaydedilirken sunucu hatası oluştu.'
    });
  }
});

// Yönetici: Ödeme Kaydı Güncelle (PUT /api/payments/:id)
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { payment_date, amount, recipient, category, payment_method, notes, type } = req.body;

  if (!payment_date || amount === undefined || !recipient || !category) {
    return res.status(400).json({
      success: false,
      message: 'Lütfen tüm zorunlu alanları doldurunuz.'
    });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Lütfen geçerli bir tutar giriniz.'
    });
  }

  const existing = db.prepare('SELECT type FROM payments WHERE id = ?').get(id);
  const paymentType = type ? (type === 'income' ? 'income' : 'expense') : (existing ? (existing.type || 'expense') : 'expense');

  try {
    const stmt = db.prepare(`
      UPDATE payments
      SET type = ?, payment_date = ?, amount = ?, recipient = ?, category = ?, payment_method = ?, notes = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      paymentType,
      payment_date.trim(),
      parsedAmount,
      recipient.trim(),
      category.trim(),
      payment_method ? payment_method.trim() : 'Nakit',
      notes ? notes.trim() : null,
      id
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Ödeme kaydı bulunamadı.' });
    }

    res.json({
      success: true,
      message: 'Ödeme kaydı güncellendi.'
    });
  } catch (error) {
    console.error('Ödeme güncelleme hatası:', error);
    res.status(500).json({ success: false, message: 'Ödeme güncellenemedi.' });
  }
});

// Yönetici: Ödeme Kaydı Sil (DELETE /api/payments/:id)
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare('DELETE FROM payments WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Silinecek ödeme kaydı bulunamadı.' });
    }

    res.json({
      success: true,
      message: 'Ödeme kaydı başarıyla silindi.'
    });
  } catch (error) {
    console.error('Ödeme silme hatası:', error);
    res.status(500).json({ success: false, message: 'Ödeme silinemedi.' });
  }
});

module.exports = router;
