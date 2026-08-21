const express = require('express');
const router = express.Router();
const { db, autoCloseStaleShifts } = require('../database');
const { authenticateToken } = require('../auth');

// Tarih formatlayıcı yardımcı: Her zaman evrensel UTC ISO-8601 formatı (Z sonlu)
function toIsoDateTime(dateInput = new Date()) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput.toISOString();
  const d = new Date(dateInput);
  return isNaN(d.getTime()) ? String(dateInput) : d.toISOString();
}

// Süre hesaplama fonksiyonu (dakika cinsinden)
function calculateDurationMinutes(entryTime, exitTime) {
  if (!entryTime || !exitTime) return 0;
  const start = new Date(entryTime).getTime();
  const end = new Date(exitTime).getTime();
  if (isNaN(start) || isNaN(end)) return 0;
  const diffMs = end - start;
  if (diffMs <= 0) return 0;
  return Math.round(diffMs / (1000 * 60));
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
  // Önce süresi dolmuş (8 saat üzeri) açık vardiyaları otomatik kapat
  if (typeof autoCloseStaleShifts === 'function') {
    autoCloseStaleShifts();
  }

  const { employee_name, workplace, work_location, department, latitude, longitude, entry_latitude, entry_longitude } = req.body;
  const targetWorkplace = workplace || work_location || department || '';

  if (!employee_name || employee_name.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Çalışan adı alanı zorunludur.'
    });
  }

  const cleanName = employee_name.trim();
  const cleanPlace = targetWorkplace ? targetWorkplace.trim() : '';

  // GPS Konum ayrıştırma
  const latVal = (latitude !== undefined && latitude !== null && !isNaN(parseFloat(latitude)))
    ? parseFloat(latitude)
    : (entry_latitude !== undefined && entry_latitude !== null && !isNaN(parseFloat(entry_latitude)) ? parseFloat(entry_latitude) : null);

  const lngVal = (longitude !== undefined && longitude !== null && !isNaN(parseFloat(longitude)))
    ? parseFloat(longitude)
    : (entry_longitude !== undefined && entry_longitude !== null && !isNaN(parseFloat(entry_longitude)) ? parseFloat(entry_longitude) : null);

  // GPS ZORUNLULUĞU: Konum bilgisi olmadan vardiya başlatılamaz
  if (latVal === null || lngVal === null || isNaN(latVal) || isNaN(lngVal)) {
    return res.status(400).json({
      success: false,
      gpsRequired: true,
      message: 'Vardiya kaydının geçerli sayılabilmesi için yasal mevzuat ve şirket denetim kuralları gereği anlık GPS konum paylaşımı zorunludur. Lütfen tarayıcı ayarlarınızdan konum izni vererek tekrar deneyiniz.'
    });
  }

  try {
    // İsim bazlı (küçük/büyük harf duyarsız ve trimlenmiş) açık vardiya kontrolü
    const existingActive = db.prepare(`
      SELECT * FROM shifts 
      WHERE LOWER(TRIM(employee_name)) = LOWER(?) 
        AND (status = 'active' OR exit_time IS NULL OR exit_time = '')
      ORDER BY id DESC LIMIT 1
    `).get(cleanName);

    if (existingActive) {
      return res.status(400).json({
        success: false,
        alreadyActive: true,
        message: 'Bu çalışan adına zaten açık ve devam eden bir vardiya bulunmaktadır. Yeni giriş yapmadan önce mevcut vardiya sonlandırılmalıdır.',
        shiftId: existingActive.id,
        shift: {
          id: existingActive.id,
          employee_name: existingActive.employee_name,
          workplace: existingActive.workplace || '',
          entry_time: existingActive.entry_time,
          entry_latitude: existingActive.entry_latitude,
          entry_longitude: existingActive.entry_longitude,
          status: 'active'
        }
      });
    }

    // Sunucu saati ile UTC ISO formatında entry_time oluştur (Manipülasyonu engellemek için)
    const entry_time = toIsoDateTime(new Date());

    const stmt = db.prepare(`
      INSERT INTO shifts (employee_name, workplace, entry_time, exit_time, duration_minutes, status, notes, entry_latitude, entry_longitude, created_at)
      VALUES (?, ?, ?, NULL, 0, 'active', NULL, ?, ?, datetime('now', 'localtime'))
    `);

    const result = stmt.run(cleanName, cleanPlace, entry_time, latVal, lngVal);
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

// 2. YENİ İŞ AKIŞI: Vardiyayı Bitir / Çıkış Yap (PUT /api/shifts/:id/end & POST /api/shifts/end)
function handleShiftTermination(req, res, targetId) {
  const id = targetId || req.params.id || req.body.id || req.body.shiftId;
  const { notes, latitude, longitude, checkout_latitude, checkout_longitude, checkout_location_name, employee_name } = req.body;

  try {
    let shift = null;
    if (id) {
      shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(id);
    } else if (employee_name && employee_name.trim() !== '') {
      shift = db.prepare(`
        SELECT * FROM shifts 
        WHERE employee_name = ? AND (status = 'active' OR exit_time IS NULL)
        ORDER BY id DESC LIMIT 1
      `).get(employee_name.trim());
    }

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Açık vardiya kaydı bulunamadı.'
      });
    }

    // GPS Çıkış Konum ayrıştırma (varsa float, yoksa null)
    const checkoutLatVal = (latitude !== undefined && latitude !== null && !isNaN(parseFloat(latitude)))
      ? parseFloat(latitude)
      : (checkout_latitude !== undefined && checkout_latitude !== null && !isNaN(parseFloat(checkout_latitude)) ? parseFloat(checkout_latitude) : null);

    const checkoutLngVal = (longitude !== undefined && longitude !== null && !isNaN(parseFloat(longitude)))
      ? parseFloat(longitude)
      : (checkout_longitude !== undefined && checkout_longitude !== null && !isNaN(parseFloat(checkout_longitude)) ? parseFloat(checkout_longitude) : null);

    const checkoutLocName = (checkout_location_name && checkout_location_name.trim() !== '') ? checkout_location_name.trim() : null;

    // ÇIKIŞ GPS ZORUNLULUĞU: Konum olmadan vardiya sonlandırılamaz
    if (checkoutLatVal === null || checkoutLngVal === null || isNaN(checkoutLatVal) || isNaN(checkoutLngVal)) {
      return res.status(400).json({
        success: false,
        gpsRequired: true,
        message: 'Vardiyanızı sonlandırabilmek için anlık GPS konumunuzun doğrulanması zorunludur. Lütfen tarayıcınızdan konum izni vererek tekrar çıkış yapınız.'
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

    // Sunucu saati ile UTC ISO formatında exit_time oluştur (Z formatı)
    const exit_time = toIsoDateTime(new Date());
    const durationMinutes = calculateDurationMinutes(shift.entry_time, exit_time);
    const finalNotes = (notes !== undefined && notes !== null && notes.trim() !== '') ? notes.trim() : (shift.notes || null);

    const updateStmt = db.prepare(`
      UPDATE shifts
      SET exit_time = ?, duration_minutes = ?, status = 'completed', notes = ?,
          checkout_latitude = ?, checkout_longitude = ?, checkout_location_name = ?
      WHERE id = ?
    `);

    updateStmt.run(exit_time, durationMinutes, finalNotes, checkoutLatVal, checkoutLngVal, checkoutLocName, shift.id);

    const updatedShift = {
      id: shift.id,
      employee_name: shift.employee_name,
      workplace: shift.workplace,
      entry_time: shift.entry_time,
      entry_latitude: shift.entry_latitude,
      entry_longitude: shift.entry_longitude,
      exit_time,
      checkout_latitude: checkoutLatVal,
      checkout_longitude: checkoutLngVal,
      checkout_location_name: checkoutLocName,
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
}

router.put('/:id/end', (req, res) => handleShiftTermination(req, res, req.params.id));
router.post('/:id/end', (req, res) => handleShiftTermination(req, res, req.params.id));
router.post('/end', (req, res) => handleShiftTermination(req, res));

// 3. AKTİF VARDİYA SORGULAMA (Sayfa Yenileme ve Doğrulama - GET /api/shifts/active)
router.get('/active', (req, res) => {
  try {
    if (typeof autoCloseStaleShifts === 'function') {
      autoCloseStaleShifts();
    }

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
        WHERE LOWER(TRIM(employee_name)) = LOWER(?) AND (status = 'active' OR exit_time IS NULL)
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
  const {
    employee_name, workplace, entry_time, exit_time, notes,
    entry_latitude, entry_longitude, latitude, longitude,
    checkout_latitude, checkout_longitude, checkout_location_name
  } = req.body;

  if (!employee_name || !entry_time) {
    return res.status(400).json({
      success: false,
      message: 'Çalışan adı ve giriş saati zorunludur.'
    });
  }

  const cleanPlace = (workplace && workplace.trim()) ? workplace.trim() : '';

  const latVal = (latitude !== undefined && latitude !== null && !isNaN(parseFloat(latitude)))
    ? parseFloat(latitude)
    : (entry_latitude !== undefined && entry_latitude !== null && !isNaN(parseFloat(entry_latitude)) ? parseFloat(entry_latitude) : null);

  const lngVal = (longitude !== undefined && longitude !== null && !isNaN(parseFloat(longitude)))
    ? parseFloat(longitude)
    : (entry_longitude !== undefined && entry_longitude !== null && !isNaN(parseFloat(entry_longitude)) ? parseFloat(entry_longitude) : null);

  const outLatVal = (checkout_latitude !== undefined && checkout_latitude !== null && !isNaN(parseFloat(checkout_latitude)))
    ? parseFloat(checkout_latitude) : null;

  const outLngVal = (checkout_longitude !== undefined && checkout_longitude !== null && !isNaN(parseFloat(checkout_longitude)))
    ? parseFloat(checkout_longitude) : null;

  const outLocName = (checkout_location_name && checkout_location_name.trim() !== '') ? checkout_location_name.trim() : null;

  try {
    const normalizedEntry = toIsoDateTime(entry_time);
    const normalizedExit = exit_time ? toIsoDateTime(exit_time) : null;

    // Gelecek tarih ve mantıksal zaman kontrolü
    const maxAllowedTime = new Date().getTime() + 60000;
    const entryDate = new Date(normalizedEntry);
    if (entryDate.getTime() > maxAllowedTime) {
      return res.status(400).json({
        success: false,
        message: 'Giriş saati sunucunun şu anki saatinden ileri bir tarih olamaz.'
      });
    }

    if (normalizedExit) {
      const exitDate = new Date(normalizedExit);
      if (exitDate.getTime() > maxAllowedTime) {
        return res.status(400).json({
          success: false,
          message: 'Çıkış saati sunucunun şu anki saatinden ileri bir tarih olamaz.'
        });
      }
      if (exitDate.getTime() < entryDate.getTime()) {
        return res.status(400).json({
          success: false,
          message: 'Çıkış saati giriş saatinden önce olamaz.'
        });
      }
    }

    let durationMinutes = 0;
    const status = normalizedExit ? 'completed' : 'active';
    if (normalizedExit) {
      durationMinutes = calculateDurationMinutes(normalizedEntry, normalizedExit);
    }

    const stmt = db.prepare(`
      INSERT INTO shifts (employee_name, workplace, entry_time, exit_time, duration_minutes, status, notes, entry_latitude, entry_longitude, checkout_latitude, checkout_longitude, checkout_location_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);

    const result = stmt.run(
      employee_name.trim(),
      cleanPlace,
      normalizedEntry,
      normalizedExit || null,
      durationMinutes,
      status,
      notes ? notes.trim() : null,
      latVal,
      lngVal,
      outLatVal,
      outLngVal,
      outLocName
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
    if (typeof autoCloseStaleShifts === 'function') {
      autoCloseStaleShifts();
    }

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
      params.push(endDate.trim().includes('T') ? endDate.trim() : `${endDate.trim()}T23:59:59.999Z`);
    }

    query += ' ORDER BY entry_time DESC, id DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    // Süreleri, durumları ve konum linklerini zenginleştir
    const enrichedRows = rows.map(row => {
      const isActive = row.status === 'active' || !row.exit_time;
      const hasEntryLocation = row.entry_latitude !== null && row.entry_latitude !== undefined && row.entry_longitude !== null && row.entry_longitude !== undefined && !isNaN(row.entry_latitude) && !isNaN(row.entry_longitude);
      const hasCheckoutLocation = row.checkout_latitude !== null && row.checkout_latitude !== undefined && row.checkout_longitude !== null && row.checkout_longitude !== undefined && !isNaN(row.checkout_latitude) && !isNaN(row.checkout_longitude);

      const entryMapUrl = hasEntryLocation ? `https://www.google.com/maps?q=${row.entry_latitude},${row.entry_longitude}` : null;
      const checkoutMapUrl = hasCheckoutLocation ? `https://www.google.com/maps?q=${row.checkout_latitude},${row.checkout_longitude}` : null;

      return {
        ...row,
        status: isActive ? 'active' : 'completed',
        hasLocation: hasEntryLocation || hasCheckoutLocation,
        hasEntryLocation,
        hasCheckoutLocation,
        entryMapUrl,
        checkoutMapUrl,
        mapUrl: entryMapUrl || checkoutMapUrl,
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
  const {
    employee_name, workplace, entry_time, exit_time, notes,
    entry_latitude, entry_longitude, latitude, longitude,
    checkout_latitude, checkout_longitude, checkout_location_name
  } = req.body;

  if (!employee_name || !entry_time) {
    return res.status(400).json({
      success: false,
      message: 'Lütfen çalışan adı ve giriş saatini doldurunuz.'
    });
  }

  const cleanPlace = (workplace && workplace.trim()) ? workplace.trim() : '';

  const latVal = (latitude !== undefined && latitude !== null && !isNaN(parseFloat(latitude)))
    ? parseFloat(latitude)
    : (entry_latitude !== undefined && entry_latitude !== null && !isNaN(parseFloat(entry_latitude)) ? parseFloat(entry_latitude) : null);

  const lngVal = (longitude !== undefined && longitude !== null && !isNaN(parseFloat(longitude)))
    ? parseFloat(longitude)
    : (entry_longitude !== undefined && entry_longitude !== null && !isNaN(parseFloat(entry_longitude)) ? parseFloat(entry_longitude) : null);

  const outLatVal = (checkout_latitude !== undefined && checkout_latitude !== null && !isNaN(parseFloat(checkout_latitude)))
    ? parseFloat(checkout_latitude) : null;

  const outLngVal = (checkout_longitude !== undefined && checkout_longitude !== null && !isNaN(parseFloat(checkout_longitude)))
    ? parseFloat(checkout_longitude) : null;

  const outLocName = (checkout_location_name && checkout_location_name.trim() !== '') ? checkout_location_name.trim() : null;

  try {
    const normalizedEntry = toIsoDateTime(entry_time);
    const normalizedExit = exit_time ? toIsoDateTime(exit_time) : null;

    // Gelecek tarih ve mantıksal zaman kontrolü
    const maxAllowedTime = new Date().getTime() + 60000;
    const entryDate = new Date(normalizedEntry);
    if (entryDate.getTime() > maxAllowedTime) {
      return res.status(400).json({
        success: false,
        message: 'Giriş saati sunucunun şu anki saatinden ileri bir tarih olamaz.'
      });
    }

    if (normalizedExit) {
      const exitDate = new Date(normalizedExit);
      if (exitDate.getTime() > maxAllowedTime) {
        return res.status(400).json({
          success: false,
          message: 'Çıkış saati sunucunun şu anki saatinden ileri bir tarih olamaz.'
        });
      }
      if (exitDate.getTime() < entryDate.getTime()) {
        return res.status(400).json({
          success: false,
          message: 'Çıkış saati giriş saatinden önce olamaz.'
        });
      }
    }

    const durationMinutes = normalizedExit ? calculateDurationMinutes(normalizedEntry, normalizedExit) : 0;
    const status = normalizedExit ? 'completed' : 'active';

    const stmt = db.prepare(`
      INSERT INTO shifts (employee_name, workplace, entry_time, exit_time, duration_minutes, status, notes, entry_latitude, entry_longitude, checkout_latitude, checkout_longitude, checkout_location_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);

    const result = stmt.run(
      employee_name.trim(),
      cleanPlace,
      normalizedEntry,
      normalizedExit || null,
      durationMinutes,
      status,
      notes ? notes.trim() : null,
      latVal,
      lngVal,
      outLatVal,
      outLngVal,
      outLocName
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
  const {
    employee_name, workplace, entry_time, exit_time, notes,
    entry_latitude, entry_longitude,
    checkout_latitude, checkout_longitude, checkout_location_name
  } = req.body;

  if (!employee_name || !entry_time) {
    return res.status(400).json({
      success: false,
      message: 'Lütfen çalışan adı ve giriş saatini doldurunuz.'
    });
  }

  try {
    const normalizedEntry = toIsoDateTime(entry_time);
    const normalizedExit = exit_time ? toIsoDateTime(exit_time) : null;

    // Gelecek tarih ve mantıksal zaman kontrolü
    const maxAllowedTime = new Date().getTime() + 60000;
    const entryDate = new Date(normalizedEntry);
    if (entryDate.getTime() > maxAllowedTime) {
      return res.status(400).json({
        success: false,
        message: 'Giriş saati sunucunun şu anki saatinden ileri bir tarih olamaz.'
      });
    }

    if (normalizedExit) {
      const exitDate = new Date(normalizedExit);
      if (exitDate.getTime() > maxAllowedTime) {
        return res.status(400).json({
          success: false,
          message: 'Çıkış saati sunucunun şu anki saatinden ileri bir tarih olamaz.'
        });
      }
      if (exitDate.getTime() < entryDate.getTime()) {
        return res.status(400).json({
          success: false,
          message: 'Çıkış saati giriş saatinden önce olamaz.'
        });
      }
    }

    const durationMinutes = normalizedExit ? calculateDurationMinutes(normalizedEntry, normalizedExit) : 0;
    const status = normalizedExit ? 'completed' : 'active';

    // Mevcut kaydı çek ki konum üzerine yazılmasın (eğer gönderilmemişse)
    const existing = db.prepare('SELECT entry_latitude, entry_longitude, checkout_latitude, checkout_longitude, checkout_location_name, workplace FROM shifts WHERE id = ?').get(id);
    const cleanPlace = workplace !== undefined ? (workplace ? workplace.trim() : '') : (existing ? (existing.workplace || '') : '');
    const finalLat = entry_latitude !== undefined ? entry_latitude : (existing ? existing.entry_latitude : null);
    const finalLng = entry_longitude !== undefined ? entry_longitude : (existing ? existing.entry_longitude : null);
    const finalOutLat = checkout_latitude !== undefined ? checkout_latitude : (existing ? existing.checkout_latitude : null);
    const finalOutLng = checkout_longitude !== undefined ? checkout_longitude : (existing ? existing.checkout_longitude : null);
    const finalOutLoc = checkout_location_name !== undefined ? checkout_location_name : (existing ? existing.checkout_location_name : null);

    const stmt = db.prepare(`
      UPDATE shifts
      SET employee_name = ?, workplace = ?, entry_time = ?, exit_time = ?, duration_minutes = ?, status = ?, notes = ?,
          entry_latitude = ?, entry_longitude = ?,
          checkout_latitude = ?, checkout_longitude = ?, checkout_location_name = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      employee_name.trim(),
      cleanPlace,
      normalizedEntry,
      normalizedExit || null,
      durationMinutes,
      status,
      notes ? notes.trim() : null,
      finalLat,
      finalLng,
      finalOutLat,
      finalOutLng,
      finalOutLoc,
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
