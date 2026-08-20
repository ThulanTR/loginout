const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticateToken } = require('../auth');

// Süre hesaplama fonksiyonu (dakika cinsinden, UTC ISO ve tüm formatları destekler)
function calculateDurationMinutes(entryTime, exitTime) {
  if (!entryTime || !exitTime) return 0;
  const start = new Date(entryTime).getTime();
  const end = new Date(exitTime).getTime();
  if (isNaN(start) || isNaN(end)) return 0;
  const diffMs = end - start;
  if (diffMs <= 0) return 0;
  return Math.round(diffMs / (1000 * 60));
}

// Tarih stringini standart UTC ISO formatına dönüştürme yardımcısı
function normalizeToISO(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput.toISOString();
  const str = String(dateInput).trim();
  if (str.endsWith('Z')) return str;
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? str : parsed.toISOString();
}

// Süreyi okunabilir metne dönüştürme (Örn: "8 sa 30 dk")
function formatDuration(minutes) {
  if (minutes === undefined || minutes === null || minutes < 0) return 'Devam Ediyor';
  if (minutes === 0) return '1 dakikadan az';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours} sa ${mins} dk`;
  if (hours > 0) return `${hours} saat`;
  return `${mins} dakika`;
}

// Otomatik tamamlama için kayıtlı çalışanlar ve çalışma yerleri (Herkese açık)
router.get('/suggestions', (req, res) => {
  try {
    const employeeRows = db.prepare('SELECT DISTINCT employee_name FROM shifts ORDER BY employee_name ASC').all();
    const workplaceRows = db.prepare('SELECT DISTINCT workplace FROM shifts ORDER BY workplace ASC').all();

    res.json({
      success: true,
      employees: employeeRows.map(r => r.employee_name),
      workplaces: workplaceRows.map(r => r.workplace)
    });
  } catch (error) {
    console.error('Öneri getirme hatası:', error);
    res.status(500).json({ success: false, message: 'Veriler alınamadı.' });
  }
});

// 1. YENİ İŞ AKIŞI: Vardiyayı Başlat / Giriş Yap (POST /api/shifts/start)
router.post('/start', (req, res) => {
  const { employee_name, workplace, work_location, latitude, longitude, entry_latitude, entry_longitude } = req.body;
  const targetWorkplace = workplace || work_location;

  if (!employee_name || !targetWorkplace || employee_name.trim() === '' || targetWorkplace.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Çalışan adı ve çalışma yeri alanları zorunludur.'
    });
  }

  const cleanName = employee_name.trim();
  const cleanPlace = targetWorkplace.trim();

  // GPS Konum ayrıştırma (varsa float, yoksa null)
  const latVal = (latitude !== undefined && latitude !== null && !isNaN(parseFloat(latitude)))
    ? parseFloat(latitude)
    : (entry_latitude !== undefined && entry_latitude !== null && !isNaN(parseFloat(entry_latitude)) ? parseFloat(entry_latitude) : null);

  const lngVal = (longitude !== undefined && longitude !== null && !isNaN(parseFloat(longitude)))
    ? parseFloat(longitude)
    : (entry_longitude !== undefined && entry_longitude !== null && !isNaN(parseFloat(entry_longitude)) ? parseFloat(entry_longitude) : null);

  try {
    // Aynı çalışanın halihazırda açık bir vardiyası var mı kontrol et
    const existingActive = db.prepare(`
      SELECT * FROM shifts 
      WHERE employee_name = ? AND (status = 'active' OR exit_time IS NULL)
      ORDER BY id DESC LIMIT 1
    `).get(cleanName);

    if (existingActive) {
      return res.status(200).json({
        success: true,
        alreadyActive: true,
        message: `${cleanName} için halen devam eden aktif bir vardiya bulunmaktadır.`,
        shiftId: existingActive.id,
        shift: {
          id: existingActive.id,
          employee_name: existingActive.employee_name,
          workplace: existingActive.workplace,
          entry_time: existingActive.entry_time,
          entry_latitude: existingActive.entry_latitude,
          entry_longitude: existingActive.entry_longitude,
          status: 'active'
        }
      });
    }

    // Sunucu saati ile UTC ISO formatında entry_time oluştur
    const entry_time = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO shifts (employee_name, workplace, entry_time, exit_time, duration_minutes, status, notes, entry_latitude, entry_longitude, created_at)
      VALUES (?, ?, ?, NULL, 0, 'active', NULL, ?, ?, ?)
    `);

    const result = stmt.run(cleanName, cleanPlace, entry_time, latVal, lngVal, entry_time);
    const shiftId = result.lastInsertRowid;

    res.status(201).json({
      success: true,
      message: 'Vardiya girişi başarıyla yapıldı. İyi çalışmalar dileriz!',
      shiftId,
      shift: {
        id: shiftId,
        employee_name: cleanName,
        workplace: cleanPlace,
        entry_time,
        entry_latitude: latVal,
        entry_longitude: lngVal,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('Vardiya başlatma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Vardiya başlatılırken sunucu hatası oluştu.'
    });
  }
});

// 2. YENİ İŞ AKIŞI: Vardiyayı Bitir / Çıkış Yap (PUT /api/shifts/:id/end)
router.put('/:id/end', (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  try {
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(id);

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Açık vardiya kaydı bulunamadı.'
      });
    }

    // Eğer zaten tamamlanmışsa
    if (shift.status === 'completed' && shift.exit_time) {
      return res.status(200).json({
        success: true,
        alreadyCompleted: true,
        message: 'Bu vardiya daha önce tamamlanmıştır.',
        shift: {
          ...shift,
          durationFormatted: formatDuration(shift.duration_minutes)
        }
      });
    }

    // Sunucu saati ile UTC ISO formatında exit_time oluştur
    const exit_time = new Date().toISOString();
    const durationMinutes = calculateDurationMinutes(shift.entry_time, exit_time);
    const finalNotes = (notes !== undefined && notes !== null && notes.trim() !== '') ? notes.trim() : (shift.notes || null);

    const updateStmt = db.prepare(`
      UPDATE shifts
      SET exit_time = ?, duration_minutes = ?, status = 'completed', notes = ?
      WHERE id = ?
    `);

    updateStmt.run(exit_time, durationMinutes, finalNotes, id);

    const updatedShift = {
      id: shift.id,
      employee_name: shift.employee_name,
      workplace: shift.workplace,
      entry_time: shift.entry_time,
      exit_time,
      duration_minutes: durationMinutes,
      durationFormatted: formatDuration(durationMinutes),
      notes: finalNotes,
      status: 'completed'
    };

    res.json({
      success: true,
      message: 'Vardiya çıkışı başarıyla kaydedildi. Tebrikler!',
      shift: updatedShift
    });
  } catch (error) {
    console.error('Vardiya sonlandırma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Vardiya sonlandırılırken sunucu hatası oluştu.'
    });
  }
});

// 3. AKTİF VARDİYA SORGULAMA (Sayfa Yenileme ve Doğrulama - GET /api/shifts/active)
router.get('/active', (req, res) => {
  try {
    const { employee_name, id } = req.query;

    let shift = null;

    if (id) {
      shift = db.prepare(`
        SELECT * FROM shifts 
        WHERE id = ? AND (status = 'active' OR exit_time IS NULL)
      `).get(id);
    } else if (employee_name && employee_name.trim() !== '') {
      shift = db.prepare(`
        SELECT * FROM shifts 
        WHERE employee_name = ? AND (status = 'active' OR exit_time IS NULL)
        ORDER BY id DESC LIMIT 1
      `).get(employee_name.trim());
    } else {
      // Genel aktif vardiyaları getir
      const activeShifts = db.prepare(`
        SELECT * FROM shifts 
        WHERE status = 'active' OR exit_time IS NULL 
        ORDER BY entry_time DESC
      `).all();

      return res.json({
        success: true,
        count: activeShifts.length,
        shifts: activeShifts
      });
    }

    res.json({
      success: true,
      hasActiveShift: !!shift,
      shift: shift || null
    });
  } catch (error) {
    console.error('Aktif vardiya sorgulama hatası:', error);
    res.status(500).json({ success: false, message: 'Aktif vardiya durumu sorgulanamadı.' });
  }
});

// Geriye Dönük / Genel Vardiya Kaydetme (POST /api/shifts)
router.post('/', (req, res) => {
  const { employee_name, workplace, entry_time, exit_time, notes, entry_latitude, entry_longitude, latitude, longitude } = req.body;

  if (!employee_name || !workplace || !entry_time) {
    return res.status(400).json({
      success: false,
      message: 'Çalışan adı, çalışma yeri ve giriş saati zorunludur.'
    });
  }

  const latVal = (latitude !== undefined && latitude !== null && !isNaN(parseFloat(latitude)))
    ? parseFloat(latitude)
    : (entry_latitude !== undefined && entry_latitude !== null && !isNaN(parseFloat(entry_latitude)) ? parseFloat(entry_latitude) : null);

  const lngVal = (longitude !== undefined && longitude !== null && !isNaN(parseFloat(longitude)))
    ? parseFloat(longitude)
    : (entry_longitude !== undefined && entry_longitude !== null && !isNaN(parseFloat(entry_longitude)) ? parseFloat(entry_longitude) : null);

  try {
    const normEntry = normalizeToISO(entry_time);
    const normExit = exit_time ? normalizeToISO(exit_time) : null;
    const durationMinutes = normExit ? calculateDurationMinutes(normEntry, normExit) : 0;
    const status = normExit ? 'completed' : 'active';
    const nowIso = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO shifts (employee_name, workplace, entry_time, exit_time, duration_minutes, status, notes, entry_latitude, entry_longitude, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      employee_name.trim(),
      workplace.trim(),
      normEntry,
      normExit,
      durationMinutes,
      status,
      notes ? notes.trim() : null,
      latVal,
      lngVal,
      nowIso
    );

    res.status(201).json({
      success: true,
      message: 'Giriş-çıkış kaydınız başarıyla sisteme işlendi.',
      shiftId: result.lastInsertRowid,
      durationFormatted: formatDuration(durationMinutes)
    });
  } catch (error) {
    console.error('Vardiya kaydetme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Kayıt işlenirken sunucu hatası oluştu.'
    });
  }
});

// Yönetici: Tüm Giriş-Çıkış Kayıtlarını Listele ve Filtrele (GET /api/shifts)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { search, workplace, startDate, endDate, status } = req.query;

    let query = 'SELECT * FROM shifts WHERE 1=1';
    const params = [];

    if (search && search.trim() !== '') {
      query += ' AND (employee_name LIKE ? OR notes LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (workplace && workplace.trim() !== '') {
      query += ' AND workplace = ?';
      params.push(workplace.trim());
    }

    if (status && status.trim() !== '') {
      query += ' AND status = ?';
      params.push(status.trim());
    }

    if (startDate && startDate.trim() !== '') {
      query += ' AND entry_time >= ?';
      params.push(startDate.trim());
    }

    if (endDate && endDate.trim() !== '') {
      query += ' AND entry_time <= ?';
      params.push(endDate.trim().includes('T') ? endDate.trim() : `${endDate.trim()}T23:59:59`);
    }

    query += ' ORDER BY entry_time DESC, id DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    // Süreleri, durumları ve konum linklerini zenginleştir
    const enrichedRows = rows.map(row => {
      const isActive = row.status === 'active' || !row.exit_time;
      const hasLocation = row.entry_latitude !== null && row.entry_longitude !== null && !isNaN(row.entry_latitude) && !isNaN(row.entry_longitude);
      return {
        ...row,
        status: isActive ? 'active' : 'completed',
        hasLocation,
        mapUrl: hasLocation ? `https://www.google.com/maps?q=${row.entry_latitude},${row.entry_longitude}` : null,
        durationFormatted: isActive ? 'Devam Ediyor' : formatDuration(row.duration_minutes)
      };
    });

    // Filtrelenmiş toplam süre (sadece tamamlanmış olanlar)
    const totalMinutes = enrichedRows.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    res.json({
      success: true,
      data: enrichedRows,
      count: enrichedRows.length,
      totalHours: parseFloat(totalHours),
      totalFormatted: formatDuration(totalMinutes)
    });
  } catch (error) {
    console.error('Vardiya listeleme hatası:', error);
    res.status(500).json({ success: false, message: 'Kayıtlar listelenirken hata oluştu.' });
  }
});

// Yönetici: Manuel Giriş-Çıkış Ekleme (POST /api/shifts/admin)
router.post('/admin', authenticateToken, (req, res) => {
  const { employee_name, workplace, entry_time, exit_time, notes, entry_latitude, entry_longitude, latitude, longitude } = req.body;

  if (!employee_name || !workplace || !entry_time) {
    return res.status(400).json({
      success: false,
      message: 'Lütfen zorunlu alanları doldurunuz.'
    });
  }

  const latVal = (latitude !== undefined && latitude !== null && !isNaN(parseFloat(latitude)))
    ? parseFloat(latitude)
    : (entry_latitude !== undefined && entry_latitude !== null && !isNaN(parseFloat(entry_latitude)) ? parseFloat(entry_latitude) : null);

  const lngVal = (longitude !== undefined && longitude !== null && !isNaN(parseFloat(longitude)))
    ? parseFloat(longitude)
    : (entry_longitude !== undefined && entry_longitude !== null && !isNaN(parseFloat(entry_longitude)) ? parseFloat(entry_longitude) : null);

  try {
    const normEntry = normalizeToISO(entry_time);
    const normExit = exit_time ? normalizeToISO(exit_time) : null;
    const durationMinutes = normExit ? calculateDurationMinutes(normEntry, normExit) : 0;
    const status = normExit ? 'completed' : 'active';
    const nowIso = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO shifts (employee_name, workplace, entry_time, exit_time, duration_minutes, status, notes, entry_latitude, entry_longitude, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      employee_name.trim(),
      workplace.trim(),
      normEntry,
      normExit,
      durationMinutes,
      status,
      notes ? notes.trim() : null,
      latVal,
      lngVal,
      nowIso
    );

    res.status(201).json({
      success: true,
      message: 'Kayıt yönetici tarafından başarıyla eklendi.',
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Yönetici kayıt hatası:', error);
    res.status(500).json({ success: false, message: 'Kayıt eklenemedi.' });
  }
});

// Yönetici: Giriş-Çıkış Kaydını Güncelle (PUT /api/shifts/:id)
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { employee_name, workplace, entry_time, exit_time, notes, entry_latitude, entry_longitude } = req.body;

  if (!employee_name || !workplace || !entry_time) {
    return res.status(400).json({
      success: false,
      message: 'Lütfen zorunlu alanları doldurunuz.'
    });
  }

  try {
    const normEntry = normalizeToISO(entry_time);
    const normExit = exit_time ? normalizeToISO(exit_time) : null;
    const durationMinutes = normExit ? calculateDurationMinutes(normEntry, normExit) : 0;
    const status = normExit ? 'completed' : 'active';

    // Mevcut kaydı çek ki konum üzerine yazılmasın (eğer gönderilmemişse)
    const existing = db.prepare('SELECT entry_latitude, entry_longitude FROM shifts WHERE id = ?').get(id);
    const finalLat = entry_latitude !== undefined ? entry_latitude : (existing ? existing.entry_latitude : null);
    const finalLng = entry_longitude !== undefined ? entry_longitude : (existing ? existing.entry_longitude : null);

    const stmt = db.prepare(`
      UPDATE shifts
      SET employee_name = ?, workplace = ?, entry_time = ?, exit_time = ?, duration_minutes = ?, status = ?, notes = ?, entry_latitude = ?, entry_longitude = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      employee_name.trim(),
      workplace.trim(),
      normEntry,
      normExit,
      durationMinutes,
      status,
      notes ? notes.trim() : null,
      finalLat,
      finalLng,
      id
    );

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Kayıt bulunamadı.' });
    }

    res.json({
      success: true,
      message: 'Kayıt başarıyla güncellendi.'
    });
  } catch (error) {
    console.error('Kayıt güncelleme hatası:', error);
    res.status(500).json({ success: false, message: 'Kayıt güncellenemedi.' });
  }
});

// Yönetici: Giriş-Çıkış Kaydını Sil (DELETE /api/shifts/:id)
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare('DELETE FROM shifts WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Silinecek kayıt bulunamadı.' });
    }

    res.json({
      success: true,
      message: 'Giriş-çıkış kaydı başarıyla silindi.'
    });
  } catch (error) {
    console.error('Kayıt silme hatası:', error);
    res.status(500).json({ success: false, message: 'Kayıt silinemedi.' });
  }
});

module.exports = router;
