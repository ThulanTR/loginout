// ==========================================
// PERSONEL GİRİŞ-ÇIKIŞ PORTALİ - JAVASCRIPT
// ==========================================

// Global Kronometre Değişkeni
let stopwatchInterval = null;

// Lucide İkonlarını Başlat
function refreshIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

// 2 Haneli Sayı Formatlayıcı
function padZero(num) {
  return String(num).padStart(2, '0');
}

// Canlı Saat Güncelleme (Üst Menü)
function startLiveClock() {
  const clockEl = document.getElementById('liveClockText');
  if (!clockEl) return;

  function update() {
    const now = new Date();
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    clockEl.textContent = now.toLocaleDateString('tr-TR', options);
  }

  update();
  setInterval(update, 1000);
}

// ==========================================
// KRONOMETRE & SAYAÇ MOTORU
// ==========================================
function updateStopwatch(entryTimeISO) {
  const display = document.getElementById('stopwatchDisplay');
  if (!display || !entryTimeISO) return;

  const startTime = new Date(entryTimeISO).getTime();
  const now = Date.now();
  const diffSeconds = Math.max(0, Math.floor((now - startTime) / 1000));

  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;

  display.textContent = `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
}

function startStopwatch(entryTimeISO) {
  if (stopwatchInterval) {
    clearInterval(stopwatchInterval);
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
  if (statusText) statusText.textContent = 'Otomatik Sunucu Zamanlı Vardiya Takibi';

  const statusBadge = document.getElementById('portalStatusBadge');
  if (statusBadge) {
    statusBadge.className = 'inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3';
  }

  refreshIcons();
}

// Durum 2: Aktif Vardiya Durumu (Giriş Yapıldı, Kronometre Çalışıyor)
function setActiveShiftState(shift) {
  const employeeInput = document.getElementById('employeeName');
  if (employeeInput) {
    employeeInput.value = shift.employee_name;
    employeeInput.readOnly = true;
    employeeInput.classList.add('bg-slate-800/80', 'cursor-not-allowed', 'border-emerald-500/40');
  }

  const workplaceInput = document.getElementById('workplace');
  if (workplaceInput) {
    workplaceInput.value = shift.workplace;
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
  if (summaryText) summaryText.textContent = `${shift.employee_name} (${shift.workplace})`;

  const entryDisplay = document.getElementById('activeEntryTimeDisplay');
  if (entryDisplay) {
    const entryDate = new Date(shift.entry_time);
    entryDisplay.textContent = entryDate.toLocaleString('tr-TR', {
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
  if (statusText) statusText.textContent = `Vardiya Aktif: ${shift.employee_name}`;

  const statusBadge = document.getElementById('portalStatusBadge');
  if (statusBadge) {
    statusBadge.className = 'inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-3';
  }

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

    // Hemen UI'yi aç ki bekleme olmasın
    setActiveShiftState(savedShift);

    // Sunucudan aktifliğini doğrula
    try {
      const res = await fetch(`/api/shifts/active?id=${savedShift.id}`);
      const data = await res.json();

      if (data.success && data.hasActiveShift && data.shift) {
        // Sunucu teyit etti, güncel veriyi sakla
        localStorage.setItem('activeShift', JSON.stringify(data.shift));
        setActiveShiftState(data.shift);
      } else {
        // Vardiya sunucuda zaten kapatılmış veya silinmiş
        console.warn('Açık vardiya sunucu tarafında bulunamadı, form sıfırlanıyor.');
        localStorage.removeItem('activeShift');
        setInitialState();
      }
    } catch (apiErr) {
      console.warn('Sunucu doğrulama hatası (çevrimdışı olabilir):', apiErr);
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
// SON KAYITLARI GETİR (Mini Feed)
// ==========================================
async function loadRecentPublicShifts() {
  const container = document.getElementById('recentPublicShiftsList');
  if (!container) return;

  try {
    const shiftsRes = await fetch('/api/stats/dashboard', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken') || ''}`
      }
    });

    if (shiftsRes.ok) {
      const statsData = await shiftsRes.json();
      if (statsData.success && statsData.timeline) {
        const shiftEvents = statsData.timeline.filter(t => t.type === 'shift').slice(0, 4);
        if (shiftEvents.length > 0) {
          container.innerHTML = shiftEvents.map(s => {
            const isAct = s.status === 'active';
            return `
              <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border ${isAct ? 'border-amber-500/30' : 'border-slate-800'} text-xs">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full ${isAct ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}"></div>
                  <span class="font-semibold text-slate-200">${s.title}</span>
                  <span class="text-slate-400">(${s.description})</span>
                </div>
                <span class="${isAct ? 'text-amber-400 font-semibold' : 'text-slate-500'} text-[11px]">${s.timeAgo}</span>
              </div>
            `;
          }).join('');
          refreshIcons();
          return;
        }
      }
    }

    container.innerHTML = `
      <div class="text-xs text-slate-400 text-center py-2 flex items-center justify-center gap-2">
        <i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i>
        <span>Sistem aktif. Giriş ve çıkışlar sunucu saatiyle kaydedilmektedir.</span>
      </div>
    `;
    refreshIcons();
  } catch (e) {
    container.innerHTML = `
      <div class="text-xs text-slate-400 text-center py-2">
        Sistem aktif. Giriş ve çıkışlar sunucu saatiyle kaydedilmektedir.
      </div>
    `;
  }
}

// ==========================================
// GPS KONUM YARDIMCISI (Geolocation API)
// ==========================================
function getCurrentCoordinates() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Tarayıcı Geolocation API desteklemiyor.');
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
        console.warn('Konum izni verilmedi veya alınamadı:', error.message);
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
      title: 'Eksik Bilgi',
      text: 'Lütfen Adınız Soyadınız ve Çalışma Yeri / Şantiye alanlarını doldurunuz.',
      background: '#1e293b',
      color: '#f8fafc',
      confirmButtonColor: '#4f46e5'
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
    <span>Giriş Yapılıyor...</span>
  `;

  // Otomatik GPS Konumunu Al
  const coords = await getCurrentCoordinates();

  try {
    const res = await fetch('/api/shifts/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_name,
        workplace,
        latitude: coords.latitude,
        longitude: coords.longitude
      })
    });

    const result = await res.json();

    if (res.ok && result.success) {
      // LocalStorage'a kaydet
      localStorage.setItem('activeShift', JSON.stringify(result.shift));

      // UI'yı aktif vardiya moduna geçir
      setActiveShiftState(result.shift);

      const hasGps = result.shift.entry_latitude && result.shift.entry_longitude;
      const locationNote = hasGps
        ? `<div class="text-emerald-400 flex items-center gap-1.5"><i data-lucide="map-pin" class="w-3.5 h-3.5 inline"></i> <span>GPS Konumu başarıyla kaydedildi.</span></div>`
        : `<div class="text-amber-400 flex items-center gap-1.5"><i data-lucide="alert-circle" class="w-3.5 h-3.5 inline"></i> <span>Konum alınamadı, giriş kaydınız konumsuz oluşturuldu.</span></div>`;

      // Başarı bildirimi
      Swal.fire({
        icon: 'success',
        title: 'Vardiya Başlatıldı!',
        html: `
          <p class="text-sm text-slate-300 mb-2">Hoş geldiniz, <strong>${result.shift.employee_name}</strong>!</p>
          <div class="p-3 bg-slate-800/80 rounded-xl text-xs text-slate-300 text-left space-y-2 border border-slate-700">
            <div><strong class="text-indigo-300">Yer:</strong> ${result.shift.workplace}</div>
            <div><strong class="text-emerald-400">Giriş Saati:</strong> ${new Date(result.shift.entry_time).toLocaleTimeString('tr-TR')}</div>
            ${locationNote}
            <div class="text-slate-400 font-medium">Kronometreniz çalışmaya başladı. İyi çalışmalar dileriz.</div>
          </div>
        `,
        background: '#1e293b',
        color: '#f8fafc',
        confirmButtonColor: '#10b981',
        confirmButtonText: 'Tamam'
      });

      loadSuggestions();
      loadRecentPublicShifts();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Giriş Başarısız',
        text: result.message || 'Giriş kaydı oluşturulurken bir hata oluştu.',
        background: '#1e293b',
        color: '#f8fafc',
        confirmButtonColor: '#4f46e5'
      });
    }
  } catch (error) {
    console.error('Giriş isteği hatası:', error);
    Swal.fire({
      icon: 'error',
      title: 'Bağlantı Hatası',
      text: 'Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığından emin olunuz.',
      background: '#1e293b',
      color: '#f8fafc',
      confirmButtonColor: '#4f46e5'
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
      title: 'Aktif Vardiya Bulunamadı',
      text: 'Şu anda açık bir vardiyanız görünmüyor.',
      background: '#1e293b',
      color: '#f8fafc',
      confirmButtonColor: '#4f46e5'
    });
    setInitialState();
    return;
  }

  const activeShift = JSON.parse(savedShiftStr);
  const existingNotes = document.getElementById('shiftNotes')?.value || '';

  // Canlı sayaçtaki güncel süreyi al
  const currentDurationText = document.getElementById('stopwatchDisplay')?.textContent || '00:00:00';

  // SweetAlert2 ile şık onay ve not alma modalı
  const { value: formValues, isConfirmed } = await Swal.fire({
    title: 'Vardiyayı Tamamla',
    html: `
      <div class="text-left space-y-3 mb-2 text-xs sm:text-sm">
        <p class="text-slate-300"><strong>${activeShift.employee_name}</strong> için vardiya çıkışı yapılacak.</p>
        <div class="p-3 bg-slate-800 rounded-xl space-y-1.5 border border-slate-700 text-xs">
          <div><strong class="text-slate-400">Çalışma Yeri:</strong> ${activeShift.workplace}</div>
          <div><strong class="text-slate-400">Giriş Saati:</strong> ${new Date(activeShift.entry_time).toLocaleTimeString('tr-TR')}</div>
          <div><strong class="text-emerald-400">Geçen Süre:</strong> <span class="font-mono font-bold text-emerald-300">${currentDurationText}</span></div>
        </div>
        <div>
          <label class="block text-slate-300 font-medium mb-1 text-xs">İş / Vardiya Notu (Opsiyonel):</label>
          <textarea id="swalShiftNotes" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:ring-1 focus:ring-rose-500 focus:outline-none resize-none" rows="2" placeholder="Bugün yapılan işler veya notlar...">${existingNotes}</textarea>
        </div>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#475569',
    confirmButtonText: 'Evet, Çıkış Yap',
    cancelButtonText: 'Vazgeç',
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
    <span>Çıkış Kaydediliyor...</span>
  `;

  try {
    const res = await fetch(`/api/shifts/${activeShift.id}/end`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesToSend })
    });

    const result = await res.json();

    if (res.ok && result.success) {
      // LocalStorage temizle
      localStorage.removeItem('activeShift');

      // Formu başlangıç durumuna sıfırla
      setInitialState();

      // Şık Başarı Özeti Modalı
      Swal.fire({
        icon: 'success',
        title: 'Çıkış Başarıyla Tamamlandı!',
        html: `
          <p class="text-sm text-slate-300 mb-3">Tebrikler <strong>${result.shift.employee_name}</strong>, bugünkü vardiya kaydınız veritabanına işlendi.</p>
          <div class="p-4 bg-slate-800/90 rounded-xl text-xs text-slate-200 text-left space-y-2 border border-slate-700">
            <div class="flex justify-between">
              <span class="text-slate-400">Çalışma Yeri:</span>
              <strong class="text-white">${result.shift.workplace}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Giriş Saati:</span>
              <span>${new Date(result.shift.entry_time).toLocaleString('tr-TR')}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Çıkış Saati:</span>
              <span>${new Date(result.shift.exit_time).toLocaleString('tr-TR')}</span>
            </div>
            <div class="pt-2 border-t border-slate-700 flex justify-between items-center">
              <span class="text-slate-300 font-semibold">Toplam Çalışma Süresi:</span>
              <span class="text-emerald-400 font-bold font-mono text-sm bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-500/30">
                ${result.shift.durationFormatted}
              </span>
            </div>
            ${result.shift.notes ? `<div class="pt-2 border-t border-slate-700/60 text-slate-300"><strong>Not:</strong> ${result.shift.notes}</div>` : ''}
          </div>
        `,
        background: '#1e293b',
        color: '#f8fafc',
        confirmButtonColor: '#4f46e5',
        confirmButtonText: 'Tamam'
      });

      loadSuggestions();
      loadRecentPublicShifts();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Çıkış Başarısız',
        text: result.message || 'Çıkış işlemi sırasında bir hata oluştu.',
        background: '#1e293b',
        color: '#f8fafc',
        confirmButtonColor: '#4f46e5'
      });
    }
  } catch (error) {
    console.error('Çıkış hatası:', error);
    Swal.fire({
      icon: 'error',
      title: 'Bağlantı Hatası',
      text: 'Sunucuya ulaşılamadı. Lütfen internet bağlantınızı ve sunucuyu kontrol ediniz.',
      background: '#1e293b',
      color: '#f8fafc',
      confirmButtonColor: '#4f46e5'
    });
  } finally {
    endBtn.disabled = false;
    endBtn.innerHTML = originalBtnHtml;
    refreshIcons();
  }
}

// ==========================================
// SAYFA YÜKLENDİĞİNDE BAŞLATICI
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  refreshIcons();
  startLiveClock();
  loadSuggestions();
  loadRecentPublicShifts();

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

  // Form Submit engelle (Butonlar üzerinden çalışır)
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
        <span>Giriş Yapılıyor...</span>
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
            title: 'Giriş Başarılı! Yönlendiriliyorsunuz...'
          });

          setTimeout(() => {
            window.location.href = '/admin';
          }, 1000);
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Giriş Başarısız',
            text: data.message || 'Kullanıcı adı veya şifre hatalı.',
            background: '#1e293b',
            color: '#f8fafc',
            confirmButtonColor: '#4f46e5'
          });
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Panele Giriş Yap</span>`;
        }
      } catch (err) {
        console.error('Giriş isteği hatası:', err);
        Swal.fire({
          icon: 'error',
          title: 'Hata',
          text: 'Sunucuya ulaşılamadı.',
          background: '#1e293b',
          color: '#f8fafc',
          confirmButtonColor: '#4f46e5'
        });
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Panele Giriş Yap</span>`;
      }
    });
  }
});
