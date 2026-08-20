const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticateToken } = require('../auth');

function formatCurrency(amount) {
  const formatted = new Intl.NumberFormat('en-CA', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
  return `CAD$ ${formatted}`;
}

function timeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Az önce';
  if (diffMinutes < 60) return `${diffMinutes} dakika önce`;
  if (diffHours < 24) return `${diffHours} saat önce`;
  if (diffDays === 1) return 'Dün';
  if (diffDays < 30) return `${diffDays} gün önce`;
  return past.toLocaleDateString('tr-TR');
}

// Dashboard Özet İstatistikleri (GET /api/stats/dashboard)
router.get('/dashboard', authenticateToken, (req, res) => {
  try {
    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7); // "YYYY-MM"
    const todayPrefix = now.toISOString().slice(0, 10); // "YYYY-MM-DD"

    // 1. Toplam Vardiya Kaydı
    const shiftCountRow = db.prepare('SELECT COUNT(*) as count, SUM(duration_minutes) as totalMins FROM shifts').get();
    const totalShifts = shiftCountRow.count || 0;
    const totalWorkMinutes = shiftCountRow.totalMins || 0;
    const totalWorkHours = (totalWorkMinutes / 60).toFixed(1);

    // 2. Bugün Çalışan / Giriş Yapan Sayısı
    const todayActiveRow = db.prepare(`
      SELECT COUNT(DISTINCT employee_name) as count 
      FROM shifts 
      WHERE entry_time LIKE ?
    `).get(`${todayPrefix}%`);
    const todayActiveCount = todayActiveRow.count || 0;

    // 3. Toplam Yapılan Ödeme Tutarı
    const totalPayRow = db.prepare('SELECT SUM(amount) as total FROM payments').get();
    const totalPayments = totalPayRow.total || 0;

    // 4. Bu Ay Yapılan Toplam Ödeme
    const thisMonthPayRow = db.prepare(`
      SELECT SUM(amount) as total 
      FROM payments 
      WHERE payment_date LIKE ?
    `).get(`${currentMonthPrefix}%`);
    const thisMonthPayments = thisMonthPayRow.total || 0;

    // 5. Son 7 Günlük Çalışma Saatleri Dağılımı (Grafik için)
    const days = [];
    const dayLabels = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label = `${d.getDate()} ${['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][d.getMonth()]} (${dayLabels[d.getDay()]})`;

      const dayShift = db.prepare(`
        SELECT SUM(duration_minutes) as mins, COUNT(*) as shiftCount 
        FROM shifts 
        WHERE entry_time LIKE ?
      `).get(`${dateStr}%`);

      const mins = dayShift.mins || 0;
      days.push({
        date: dateStr,
        label,
        hours: parseFloat((mins / 60).toFixed(1)),
        shiftCount: dayShift.shiftCount || 0
      });
    }

    // 6. Finans Kategori Dağılımı (Grafik için)
    const categoryRows = db.prepare(`
      SELECT category, SUM(amount) as total, COUNT(*) as count 
      FROM payments 
      GROUP BY category 
      ORDER BY total DESC
    `).all();

    // 7. Son Hareketler Zaman Çizelgesi (Zaman Sıralı Karma Akış)
    const recentShifts = db.prepare(`
      SELECT id, employee_name, workplace, entry_time, exit_time, duration_minutes, status, created_at
      FROM shifts 
      ORDER BY created_at DESC, id DESC 
      LIMIT 8
    `).all();

    const recentPayments = db.prepare(`
      SELECT id, payment_date, amount, recipient, category, payment_method, created_at
      FROM payments 
      ORDER BY created_at DESC, id DESC 
      LIMIT 8
    `).all();

    const timelineEvents = [];

    recentShifts.forEach(s => {
      const isActive = s.status === 'active' || !s.exit_time;
      timelineEvents.push({
        type: 'shift',
        id: s.id,
        status: isActive ? 'active' : 'completed',
        title: isActive ? `${s.employee_name} (Giriş Yapıldı)` : `${s.employee_name} vardiya kaydı`,
        description: isActive ? `${s.workplace} - Devam Ediyor` : `${s.workplace} - Süre: ${(s.duration_minutes / 60).toFixed(1)} saat`,
        rawDate: s.created_at || s.entry_time,
        timeAgo: timeAgo(s.created_at || s.entry_time),
        badgeColor: isActive ? 'amber' : 'blue',
        icon: 'clock'
      });
    });

    recentPayments.forEach(p => {
      timelineEvents.push({
        type: 'payment',
        id: p.id,
        title: `${formatCurrency(p.amount)} ödeme yapıldı`,
        description: `Alıcı: ${p.recipient} (${p.category} - ${p.payment_method})`,
        rawDate: p.created_at || p.payment_date,
        timeAgo: timeAgo(p.created_at || p.payment_date),
        badgeColor: 'emerald',
        icon: 'banknote'
      });
    });

    // Zaman çizelgesini tarihe göre sırala
    timelineEvents.sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
    const finalTimeline = timelineEvents.slice(0, 10);

    const totalIncome = totalPayments;
    const thisMonthIncome = thisMonthPayments;

    res.json({
      success: true,
      stats: {
        totalShifts,
        totalWorkHours,
        todayActiveCount,
        totalPayments,
        totalPaymentsFormatted: formatCurrency(totalPayments),
        totalIncome,
        totalIncomeFormatted: formatCurrency(totalIncome),
        thisMonthPayments,
        thisMonthPaymentsFormatted: formatCurrency(thisMonthPayments),
        thisMonthIncome,
        thisMonthIncomeFormatted: formatCurrency(thisMonthIncome)
      },
      weeklyChart: days,
      categoryChart: categoryRows.map(c => ({
        category: c.category,
        total: c.total,
        totalFormatted: formatCurrency(c.total),
        count: c.count
      })),
      timeline: finalTimeline
    });
  } catch (error) {
    console.error('Dashboard istatistik hatası:', error);
    res.status(500).json({ success: false, message: 'Dashboard verileri alınamadı.' });
  }
});

module.exports = router;
