// ==========================================
// PERSONEL GİRİŞ-ÇIKIŞ PORTALİ - JAVASCRIPT
// ==========================================

// Global Kronometre Değişkeni
let stopwatchInterval = null;
let currentActiveShift = null;

// Lucide İkonlarını Başlat
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// 2 Haneli Sayı Formatlayıcı
function padZero(num) {
  return String(num).padStart(2, '0');
}

// Güvenli Tarih Çözümleyici (UTC ISO-8601 ve Evrensel Saat Dilimi Desteği)
function parseDateSafely(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(dateInput).trim();

  let d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d;
  }

  if (str.includes(' ') && !str.includes('T')) {
    d = new Date(str.replace(' ', 'T') + (str.includes('Z') ? '' : 'Z'));
    if (!isNaN(d.getTime())) return d;
  }

  if (!str.endsWith('Z') && !str.includes('+')) {
    d = new Date(str + 'Z');
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

// Canlı Saat Güncelleme (Üst Menü)
function startLiveClock() {
  const clockEl = document.getElementById('liveClockText');
  if (!clockEl) return;

  function update() {
    const now = new Date();
    const isTr = (typeof i18n !== 'undefined' && i18n.getCurrentLang() === 'tr');
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    clockEl.textContent = now.toLocaleDateString(isTr ? 'tr-TR' : 'en-US', options);
  }

  update();
  setInterval(update, 1000);
}

// ==========================================
// KRONOMETRE & SAYAÇ MOTORU
// ==========================================
function updateStopwatch(entryTimeISO) {
  const display = document.getElementById('stopwatchDisplay');
  if (!display) return;
  if (!entryTimeISO) {
    display.textContent = '00:00:00';
    return;
  }

  const startDate = parseDateSafely(entryTimeISO);
  if (!startDate) {
    display.textContent = '00:00:00';
    return;
  }

  const startTime = startDate.getTime();
  const now = Date.now();
  const diffMs = now - startTime;
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;

  display.textContent = `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
}

function startStopwatch(entryTimeISO) {
  if (stopwatchInterval) {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
  }
  updateStopwatch(entryTimeISO);
  stopwatchInterval = setInterval(() => {
    updateStopwatch(entryTimeISO);
  }, 1000);
}

function stopStopwatch() {
  if (stopwatchInterval) {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
  }
}

// ==========================================
// FORM DURUM YÖNETİMİ (State Transitions)
// ==========================================

// Durum 1: Başlangıç Durumu (Açık Vardiya Yok)
function setInitialState() {
  currentActiveShift = null;
  stopStopwatch();

  const stopwatchDisplay = document.getElementById('stopwatchDisplay');
  if (stopwatchDisplay) stopwatchDisplay.textContent = '00:00:00';

  const stopwatchContainer = document.getElementById('stopwatchContainer');
  if (stopwatchContainer) stopwatchContainer.classList.add('hidden');

  const alertBanner = document.getElementById('activeShiftAlertBanner');
  if (alertBanner) alertBanner.classList.add('hidden');

  const notesContainer = document.getElementById('shiftNotesContainer');
  if (notesContainer) notesContainer.classList.add('hidden');

  const shiftNotes = document.getElementById('shiftNotes');
  if (shiftNotes) shiftNotes.value = '';

  const employeeInput = document.getElementById('employeeName');
  if (employeeInput) {
    employeeInput.readOnly = false;
    employeeInput.value = '';
    employeeInput.classList.remove('bg-slate-800/80', 'cursor-not-allowed', 'border-emerald-500/40');
  }

  const workplaceInput = document.getElementById('workplace');
  if (workplaceInput) {
    workplaceInput.readOnly = false;
    workplaceInput.value = '';
    workplaceInput.classList.remove('bg-slate-800/80', 'cursor-not-allowed', 'border-emerald-500/40');
  }

  const empBadge = document.getElementById('employeeLockBadge');
  if (empBadge) empBadge.classList.add('hidden');

  const workBadge = document.getElementById('workplaceLockBadge');
  if (workBadge) workBadge.classList.add('hidden');

  const startBtn = document.getElementById('startShiftBtn');
  if (startBtn) startBtn.classList.remove('hidden');

  const endBtn = document.getElementById('endShiftBtn');
  if (endBtn) endBtn.classList.add('hidden');

  const statusText = document.getElementById('portalStatusText');
  if (statusText) statusText.textContent = t('portal_status_auto');

  const statusBadge = document.getElementById('portalStatusBadge');
  if (statusBadge) {
    statusBadge.className = 'inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3';
  }

  refreshIcons();
}

// Durum 2: Aktif Vardiya Durumu (Giriş Yapıldı, Kronometre Çalışıyor)
function setActiveShiftState(shift) {
  if (!shift || !shift.entry_time) return;
  currentActiveShift = shift;

  const employeeInput = document.getElementById('employeeName');
  if (employeeInput) {
    employeeInput.value = shift.employee_name || '';
    employeeInput.readOnly = true;
    employeeInput.classList.add('bg-slate-800/80', 'cursor-not-allowed', 'border-emerald-500/40');
  }

  const workplaceInput = document.getElementById('workplace');
  if (workplaceInput) {
    workplaceInput.value = shift.workplace || '';
    workplaceInput.readOnly = true;
    workplaceInput.classList.add('bg-slate-800/80', 'cursor-not-allowed', 'border-emerald-500/40');
  }

  const empBadge = document.getElementById('employeeLockBadge');
  if (empBadge) empBadge.classList.remove('hidden');

  const workBadge = document.getElementById('workplaceLockBadge');
  if (workBadge) workBadge.classList.remove('hidden');

  const alertBanner = document.getElementById('activeShiftAlertBanner');
  if (alertBanner) alertBanner.classList.remove('hidden');

  const summaryText = document.getElementById('activeEmployeeSummaryText');
  if (summaryText) summaryText.textContent = `${shift.employee_name}${shift.workplace ? ` (${shift.workplace})` : ''}`;

  const entryDisplay = document.getElementById('activeEntryTimeDisplay');
  if (entryDisplay) {
    const isTr = (typeof i18n !== 'undefined' && i18n.getCurrentLang() === 'tr');
    const entryDate = parseDateSafely(shift.entry_time) || new Date();
    entryDisplay.textContent = entryDate.toLocaleString(isTr ? 'tr-TR' : 'en-US', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  const stopwatchContainer = document.getElementById('stopwatchContainer');
  if (stopwatchContainer) stopwatchContainer.classList.remove('hidden');

  const notesContainer = document.getElementById('shiftNotesContainer');
  if (notesContainer) notesContainer.classList.remove('hidden');

  const startBtn = document.getElementById('startShiftBtn');
  if (startBtn) startBtn.classList.add('hidden');

  const endBtn = document.getElementById('endShiftBtn');
  if (endBtn) endBtn.classList.remove('hidden');

  const statusText = document.getElementById('portalStatusText');
  if (statusText) statusText.textContent = `${t('portal_status_active_prefix')}${shift.employee_name}`;

  const statusBadge = document.getElementById('portalStatusBadge');
  if (statusBadge) {
    statusBadge.className = 'inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-3';
  }

  // Canlı sayacı başlat
  startStopwatch(shift.entry_time);
  refreshIcons();
}

// ==========================================
// LOCALSTORAGE VE SAYFA YENİLEME KORUMASI
// ==========================================
async function checkActiveShiftOnLoad() {
  const savedShiftStr = localStorage.getItem('activeShift');
  if (!savedShiftStr) {
    setInitialState();
    return;
  }

  try {
    const savedShift = JSON.parse(savedShiftStr);
    if (!savedShift || !savedShift.id || !savedShift.entry_time) {
      localStorage.removeItem('activeShift');
      setInitialState();
      return;
    }

    setActiveShiftState(savedShift);

    try {
      const res = await fetch(`/api/shifts/active?id=${savedShift.id}`);
      const data = await res.json();

      if (data.success && data.hasActiveShift && data.shift) {
        localStorage.setItem('activeShift', JSON.stringify(data.shift));
        setActiveShiftState(data.shift);
      } else {
        localStorage.removeItem('activeShift');
        setInitialState();
      }
    } catch (apiErr) {
      console.warn('Sunucu doğrulama hatası:', apiErr);
    }
  } catch (err) {
    console.error('Kayıtlı vardiya verisi çözümlenemedi:', err);
    localStorage.removeItem('activeShift');
    setInitialState();
  }
}

// ==========================================
// ÇALIŞAN VE ŞANTİYE ÖNERİLERİ
// ==========================================
async function loadSuggestions() {
  try {
    const res = await fetch('/api/shifts/suggestions');
    const data = await res.json();
    if (data.success) {
      const empList = document.getElementById('employeeSuggestions');
      const workList = document.getElementById('workplaceSuggestions');

      if (empList) {
        empList.innerHTML = data.employees.map(name => `<option value="${name}">`).join('');
      }
      if (workList) {
        workList.innerHTML = data.workplaces.map(place => `<option value="${place}">`).join('');
      }
    }
  } catch (err) {
    console.warn('Öneriler yüklenirken hata:', err);
  }
}

// ==========================================
// GPS KONUM YARDIMCISI (Geolocation API)
// ==========================================
function getCurrentCoordinates() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ latitude: null, longitude: null, error: 'unsupported' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: null
        });
      },
      (error) => {
        resolve({ latitude: null, longitude: null, error: error.message });
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 60000
      }
    );
  });
}

// ==========================================
// VARDİYA BAŞLATMA (GİRİŞ YAP)
// ==========================================
async function handleStartShift() {
  const employeeInput = document.getElementById('employeeName');
  const workplaceInput = document.getElementById('workplace');
  const startBtn = document.getElementById('startShiftBtn');

  const employee_name = employeeInput ? employeeInput.value.trim() : '';
  const workplace = workplaceInput ? workplaceInput.value.trim() : '';

  if (!employee_name || !workplace) {
    Swal.fire({
      icon: 'warning',
      title: t('swal_missing_info'),
      text: t('swal_fill_required'),
      background: '#1e293b',
      color: '#f8fafc',
      confirmButtonColor: '#4f46e5',
      confirmButtonText: t('swal_btn_ok')
    });
    return;
  }

  const originalBtnHtml = startBtn.innerHTML;
  startBtn.disabled = true;
  startBtn.innerHTML = `
    <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span>${t('portal_btn_checking_in')}</span>
  `;

  // Otomatik GPS Konumunu Al
  const coords = await getCurrentCoordinates();

  // GPS ZORUNLULUĞU KONTROLÜ (Yasal / Şirket Denetim Uyarısı)
  if (!coords || coords.latitude === null || coords.longitude === null || isNaN(coords.latitude) || isNaN(coords.longitude)) {
    startBtn.disabled = false;
    startBtn.innerHTML = originalBtnHtml;
    refreshIcons();

    Swal.fire({
      icon: 'warning',
      title: t('swal_gps_required_title'),
      text: t('swal_gps_required_msg'),
      background: '#1e293b',
      color: '#f8fafc',
      confirmButtonColor: '#e11d48',
      confirmButtonText: t('swal_btn_ok')
    });
    return;
  }

  try {
    const res = await fetch('/api/shifts/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_name,
        workplace,
        department: workplace,
        latitude: coords.latitude,
        longitude: coords.longitude
      })
    });

    const result = await res.json();

    if (res.ok && result.success) {
      localStorage.setItem('activeShift', JSON.stringify(result.shift));
      setActiveShiftState(result.shift);

      const hasGps = result.shift.entry_latitude && result.shift.entry_longitude;
      const locationNote = hasGps
        ? `<div class="text-emerald-400 flex items-center gap-1.5"><i data-lucide="map-pin" class="w-3.5 h-3.5 inline"></i> <span>${t('swal_gps_success')}</span></div>`
        : `<div class="text-amber-400 flex items-center gap-1.5"><i data-lucide="alert-circle" class="w-3.5 h-3.5 inline"></i> <span>${t('swal_gps_fail')}</span></div>`;

      const isTr = (typeof i18n !== 'undefined' && i18n.getCurrentLang() === 'tr');
      const entryTimeFormatted = (parseDateSafely(result.shift.entry_time) || new Date()).toLocaleTimeString(isTr ? 'tr-TR' : 'en-US');
      
      Swal.fire({
        icon: 'success',
        title: t('swal_shift_started_title'),
        html: `
          <p class="text-sm text-slate-300 mb-2">${t('swal_welcome_prefix')}<strong>${result.shift.employee_name}</strong>!</p>
          <div class="p-3 bg-slate-800/80 rounded-xl text-xs text-slate-300 text-left space-y-2 border border-slate-700">
            ${result.shift.workplace ? `<div><strong class="text-indigo-400">${t('swal_place')}</strong> ${result.shift.workplace}</div>` : ''}
            <div><strong class="text-emerald-400">${t('swal_entry_time')}</strong> ${entryTimeFormatted}</div>
            ${locationNote}
            <div class="text-slate-400 font-medium">${t('swal_timer_started')}</div>
          </div>
        `,
        background: '#1e293b',
        color: '#f8fafc',
        confirmButtonColor: '#10b981',
        confirmButtonText: t('swal_btn_ok')
      });

      loadSuggestions();
    } else {
      Swal.fire({
        icon: result.gpsRequired ? 'warning' : 'error',
        title: result.gpsRequired ? t('swal_gps_required_title') : t('swal_checkin_failed'),
        text: result.message || t('swal_checkin_failed'),
        background: '#1e293b',
        color: '#f8fafc',
        confirmButtonColor: '#4f46e5',
        confirmButtonText: t('swal_btn_ok')
      });
    }
  } catch (error) {
    console.error('Giriş isteği hatası:', error);
    Swal.fire({
      icon: 'error',
      title: t('swal_conn_error_title'),
      text: t('swal_conn_error_text'),
      background: '#1e293b',
      color: '#f8fafc',
      confirmButtonColor: '#4f46e5',
      confirmButtonText: t('swal_btn_ok')
    });
  } finally {
    startBtn.disabled = false;
    startBtn.innerHTML = originalBtnHtml;
    refreshIcons();
  }
}

// ==========================================
// VARDİYA SONLANDIRMA (ÇIKIŞ YAP)
// ==========================================
async function handleEndShift() {
  const savedShiftStr = localStorage.getItem('activeShift');
  if (!savedShiftStr) {
    Swal.fire({
      icon: 'warning',
      title: t('swal_no_active_shift'),
      text: t('swal_no_active_shift_text'),
      background: '#1e293b',
      color: '#f8fafc',
      confirmButtonColor: '#4f46e5',
      confirmButtonText: t('swal_btn_ok')
    });
    setInitialState();
    return;
  }

  const activeShift = JSON.parse(savedShiftStr);
  const existingNotes = document.getElementById('shiftNotes')?.value || '';
  const currentDurationText = document.getElementById('stopwatchDisplay')?.textContent || '00:00:00';
  
  const isTr = (typeof i18n !== 'undefined' && i18n.getCurrentLang() === 'tr');
  const entryTimeDisplayStr = (parseDateSafely(activeShift.entry_time) || new Date()).toLocaleTimeString(isTr ? 'tr-TR' : 'en-US');

  const { value: formValues, isConfirmed } = await Swal.fire({
    title: t('swal_complete_shift_title'),
    html: `
      <div class="text-left space-y-3 mb-2 text-xs sm:text-sm">
        <p class="text-slate-300"><strong>${activeShift.employee_name}</strong> ${t('swal_checkout_confirm_msg')}</p>
        <div class="p-3 bg-slate-800 rounded-xl space-y-1.5 border border-slate-700 text-xs">
          <div><strong class="text-slate-400">${t('swal_entry_time')}</strong> ${entryTimeDisplayStr}</div>
          <div><strong class="text-emerald-400">${t('swal_elapsed_time')}</strong> <span class="font-mono font-bold text-emerald-300">${currentDurationText}</span></div>
        </div>
        <div>
          <label class="block text-slate-300 font-medium mb-1 text-xs">${t('swal_optional_note_label')}</label>
          <textarea id="swalShiftNotes" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:ring-1 focus:ring-rose-500 focus:outline-none resize-none" rows="2" placeholder="${t('swal_optional_note_placeholder')}">${existingNotes}</textarea>
        </div>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#475569',
    confirmButtonText: t('swal_btn_yes_checkout'),
    cancelButtonText: t('btn_cancel'),
    background: '#1e293b',
    color: '#f8fafc',
    preConfirm: () => {
      return {
        notes: document.getElementById('swalShiftNotes').value
      };
    }
  });

  if (!isConfirmed) return;

  const notesToSend = formValues ? formValues.notes : existingNotes;
  const endBtn = document.getElementById('endShiftBtn');
  const originalBtnHtml = endBtn.innerHTML;

  endBtn.disabled = true;
  endBtn.innerHTML = `
    <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span>${t('portal_btn_checking_out')}</span>
  `;

  // Otomatik GPS Çıkış Konumunu Al
  const coords = await getCurrentCoordinates();

  // ÇIKIŞ GPS ZORUNLULUĞU KONTROLÜ (Yasal / Şirket Denetim Uyarısı)
  if (!coords || coords.latitude === null || coords.longitude === null || isNaN(coords.latitude) || isNaN(coords.longitude)) {
    endBtn.disabled = false;
    endBtn.innerHTML = originalBtnHtml;
    refreshIcons();

    Swal.fire({
      icon: 'warning',
      title: t('swal_checkout_gps_required_title'),
      text: t('swal_checkout_gps_required_msg'),
      background: '#1e293b',
      color: '#f8fafc',
      confirmButtonColor: '#e11d48',
      confirmButtonText: t('swal_btn_ok')
    });
    return;
  }

  try {
    const res = await fetch(`/api/shifts/${activeShift.id}/end`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: notesToSend,
        latitude: coords.latitude,
        longitude: coords.longitude,
        checkout_latitude: coords.latitude,
        checkout_longitude: coords.longitude
      })
    });

    const result = await res.json();

    if (res.ok && result.success) {
      localStorage.removeItem('activeShift');
      setInitialState();

      const entryTimeLocale = (parseDateSafely(result.shift.entry_time) || new Date()).toLocaleString(isTr ? 'tr-TR' : 'en-US');
      const exitTimeLocale = (parseDateSafely(result.shift.exit_time) || new Date()).toLocaleString(isTr ? 'tr-TR' : 'en-US');
      const durationFormatted = (typeof i18n !== 'undefined' && i18n.formatDurationI18n) 
        ? i18n.formatDurationI18n(result.shift.duration_minutes) 
        : result.shift.durationFormatted;

      const hasEntryGps = result.shift.entry_latitude && result.shift.entry_longitude;
      const hasExitGps = result.shift.checkout_latitude && result.shift.checkout_longitude;

      const entryGpsHtml = hasEntryGps
        ? `<div class="text-indigo-300 flex items-center gap-1.5"><i data-lucide="map-pin" class="w-3.5 h-3.5 inline"></i> <span><strong>${t('th_location_entry')}:</strong> ${t('swal_gps_success')}</span></div>`
        : `<div class="text-slate-400 flex items-center gap-1.5"><i data-lucide="map-pin-off" class="w-3.5 h-3.5 inline"></i> <span><strong>${t('th_location_entry')}:</strong> ${t('swal_gps_fail')}</span></div>`;

      const exitGpsHtml = hasExitGps
        ? `<div class="text-emerald-400 flex items-center gap-1.5"><i data-lucide="map-pin" class="w-3.5 h-3.5 inline"></i> <span><strong>${t('th_location_exit')}:</strong> ${t('swal_checkout_gps_success')}</span></div>`
        : `<div class="text-amber-400 flex items-center gap-1.5"><i data-lucide="alert-circle" class="w-3.5 h-3.5 inline"></i> <span><strong>${t('th_location_exit')}:</strong> ${t('swal_checkout_gps_fail')}</span></div>`;

      Swal.fire({
        icon: 'success',
        title: t('swal_checkout_success_title'),
        html: `
          <p class="text-sm text-slate-300 mb-3">${t('swal_checkout_success_msg', result.shift.employee_name)}</p>
          <div class="p-4 bg-slate-800/90 rounded-xl text-xs text-slate-200 text-left space-y-2 border border-slate-700">
            <div class="flex justify-between">
              <span class="text-slate-400">${t('swal_entry_time')}</span>
              <span>${entryTimeLocale}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">${t('th_exit_time')}:</span>
              <span>${exitTimeLocale}</span>
            </div>
            <div class="pt-2 border-t border-slate-700/80 space-y-1.5">
              ${entryGpsHtml}
              ${exitGpsHtml}
            </div>
            <div class="pt-2 border-t border-slate-700 flex justify-between items-center">
              <span class="text-slate-300 font-semibold">${t('swal_total_work_time')}</span>
              <span class="text-emerald-400 font-bold font-mono text-sm bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-500/30">
                ${durationFormatted}
              </span>
            </div>
            ${result.shift.notes ? `<div class="pt-2 border-t border-slate-700/60 text-slate-300"><strong>${t('swal_note_label')}</strong> ${result.shift.notes}</div>` : ''}
          </div>
        `,
        background: '#1e293b',
        color: '#f8fafc',
        confirmButtonColor: '#4f46e5',
        confirmButtonText: t('swal_btn_ok')
      });

      loadSuggestions();
    } else {
      Swal.fire({
        icon: result.gpsRequired ? 'warning' : 'error',
        title: result.gpsRequired ? t('swal_checkout_gps_required_title') : t('swal_checkout_failed'),
        text: result.message || t('swal_checkout_failed'),
        background: '#1e293b',
        color: '#f8fafc',
        confirmButtonColor: '#4f46e5',
        confirmButtonText: t('swal_btn_ok')
      });
    }
  } catch (error) {
    console.error('Çıkış hatası:', error);
    Swal.fire({
      icon: 'error',
      title: t('swal_conn_error_title'),
      text: t('swal_conn_error_text'),
      background: '#1e293b',
      color: '#f8fafc',
      confirmButtonColor: '#4f46e5',
      confirmButtonText: t('swal_btn_ok')
    });
  } finally {
    endBtn.disabled = false;
    endBtn.innerHTML = originalBtnHtml;
    refreshIcons();
  }
}

// ==========================================
// DİL DEĞİŞİKLİĞİ DİNLEYİCİSİ
// ==========================================
window.addEventListener('languageChanged', () => {
  if (currentActiveShift) {
    const statusText = document.getElementById('portalStatusText');
    if (statusText) statusText.textContent = `${t('portal_status_active_prefix')}${currentActiveShift.employee_name}`;
    
    const entryDisplay = document.getElementById('activeEntryTimeDisplay');
    if (entryDisplay && currentActiveShift.entry_time) {
      const isTr = (typeof i18n !== 'undefined' && i18n.getCurrentLang() === 'tr');
      const entryDate = parseDateSafely(currentActiveShift.entry_time) || new Date();
      entryDisplay.textContent = entryDate.toLocaleString(isTr ? 'tr-TR' : 'en-US', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  } else {
    const statusText = document.getElementById('portalStatusText');
    if (statusText) statusText.textContent = t('portal_status_auto');
  }
});

// ==========================================
// SAYFA YÜKLENDİĞİNDE BAŞLATICI
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  refreshIcons();
  startLiveClock();
  loadSuggestions();

  // Aktif vardiya durumunu kontrol et
  checkActiveShiftOnLoad();

  // Buton Dinleyicileri
  const startShiftBtn = document.getElementById('startShiftBtn');
  const endShiftBtn = document.getElementById('endShiftBtn');

  if (startShiftBtn) {
    startShiftBtn.addEventListener('click', handleStartShift);
  }

  if (endShiftBtn) {
    endShiftBtn.addEventListener('click', handleEndShift);
  }

  // Form Submit engelle
  const shiftForm = document.getElementById('shiftForm');
  if (shiftForm) {
    shiftForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const savedShiftStr = localStorage.getItem('activeShift');
      if (savedShiftStr) {
        handleEndShift();
      } else {
        handleStartShift();
      }
    });
  }

  // ==========================================
  // YÖNETİCİ GİRİŞ MODALI İŞLEMLERİ
  // ==========================================
  const loginModal = document.getElementById('loginModal');
  const openLoginBtn = document.getElementById('openLoginModalBtn');
  const closeLoginBtn = document.getElementById('closeLoginModalBtn');
  const loginForm = document.getElementById('loginForm');
  const togglePassBtn = document.getElementById('togglePasswordVisibility');
  const passInput = document.getElementById('adminPassword');

  function openModal() {
    if (loginModal) {
      const token = localStorage.getItem('adminToken');
      if (token) {
        window.location.href = '/admin';
        return;
      }
      loginModal.classList.remove('hidden');
      refreshIcons();
    }
  }

  function closeModal() {
    if (loginModal) {
      loginModal.classList.add('hidden');
    }
  }

  if (openLoginBtn) openLoginBtn.addEventListener('click', openModal);
  if (closeLoginBtn) closeLoginBtn.addEventListener('click', closeModal);

  if (loginModal) {
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) closeModal();
    });
  }

  // Şifre Göster/Gizle
  if (togglePassBtn && passInput) {
    togglePassBtn.addEventListener('click', () => {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        togglePassBtn.innerHTML = '<i data-lucide="eye-off" class="w-4 h-4"></i>';
      } else {
        passInput.type = 'password';
        togglePassBtn.innerHTML = '<i data-lucide="eye" class="w-4 h-4"></i>';
      }
      refreshIcons();
    });
  }

  // Giriş Yap Form Gönderimi
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('adminUsername').value.trim();
      const password = passInput.value;

      const submitBtn = document.getElementById('loginSubmitBtn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>${t('login_btn_submitting')}</span>
      `;

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          localStorage.setItem('adminToken', data.token);
          localStorage.setItem('adminUser', JSON.stringify(data.user));

          const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1500,
            timerProgressBar: true,
            background: '#1e293b',
            color: '#f8fafc'
          });

          Toast.fire({
            icon: 'success',
            title: t('swal_login_success')
          });

          setTimeout(() => {
            window.location.href = '/admin';
          }, 1000);
        } else {
          Swal.fire({
            icon: 'error',
            title: t('swal_login_failed'),
            text: data.message || t('swal_login_failed'),
            background: '#1e293b',
            color: '#f8fafc',
            confirmButtonColor: '#4f46e5',
            confirmButtonText: t('swal_btn_ok')
          });
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>${t('login_btn_submit')}</span>`;
        }
      } catch (err) {
        console.error('Giriş isteği hatası:', err);
        Swal.fire({
          icon: 'error',
          title: t('swal_conn_error_title'),
          text: t('swal_conn_error_text'),
          background: '#1e293b',
          color: '#f8fafc',
          confirmButtonColor: '#4f46e5',
          confirmButtonText: t('swal_btn_ok')
        });
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>${t('login_btn_submit')}</span>`;
      }
    });
  }
});
