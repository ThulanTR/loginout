// ==========================================
// YÖNETİCİ KONTROL PANELİ - JAVASCRIPT
// ==========================================

// Global Değişkenler ve Grafikler
let weeklyChartInstance = null;
let categoryChartInstance = null;
let currentShiftsData = [];
let currentPaymentsData = [];
let lastDashboardData = null;

// Token ve Güvenlik Kontrolü
function getToken() {
  return localStorage.getItem('adminToken');
}

function getAuthHeaders() {
  const token = getToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

function checkAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = '/';
    return false;
  }
  return true;
}

// İkonları Yenile
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Para Birimi Formatlayıcı (CAD$)
function formatMoney(amount) {
  const formatted = new Intl.NumberFormat('en-CA', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
  return `CAD$ ${formatted}`;
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
  if (!isNaN(d.getTime())) return d;

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

// Tarih/Saat girdileri için yerel formatlayıcı (YYYY-MM-DDTHH:mm)
function toLocalInputString(dateInput) {
  if (!dateInput) return '';
  const d = parseDateSafely(dateInput);
  if (!d) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Tarih Formatlayıcı
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = parseDateSafely(dateStr);
  if (!d) return '-';
  const isTr = (typeof i18n !== 'undefined' && i18n.getCurrentLang() === 'tr');
  return d.toLocaleDateString(isTr ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = parseDateSafely(dateStr);
  if (!d) return '-';
  const isTr = (typeof i18n !== 'undefined' && i18n.getCurrentLang() === 'tr');
  return d.toLocaleString(isTr ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTimeOnly(dateStr) {
  if (!dateStr) return '-';
  const d = parseDateSafely(dateStr);
  if (!d) return '-';
  const isTr = (typeof i18n !== 'undefined' && i18n.getCurrentLang() === 'tr');
  return d.toLocaleTimeString(isTr ? 'tr-TR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Kategori Çevirisi
function translateCategory(cat) {
  if (!cat) return '-';
  if (cat === 'Maaş' || cat === 'Salary') return t('cat_salary');
  if (cat === 'Malzeme' || cat === 'Material') return t('cat_material');
  if (cat === 'Malzeme/Gider' || cat === 'Material/Expense') return t('cat_material_expense');
  if (cat === 'Avans' || cat === 'Advance') return t('cat_advance');
  if (cat === 'Yemek/Yol' || cat === 'Food/Travel') return t('cat_food_travel');
  if (cat === 'Prim' || cat === 'Bonus') return t('cat_bonus');
  if (cat === 'Diğer' || cat === 'Other') return t('cat_other');
  return cat;
}

// ==========================================
// 1. SEKME (TAB) YÖNETİMİ
// ==========================================
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      // Buton stillerini güncelle
      tabBtns.forEach(b => {
        b.classList.remove('active', 'bg-indigo-600', 'text-white', 'shadow-md', 'shadow-indigo-600/30');
        b.classList.add('bg-slate-800/60', 'text-slate-300');
      });
      btn.classList.add('active', 'bg-indigo-600', 'text-white', 'shadow-md', 'shadow-indigo-600/30');
      btn.classList.remove('bg-slate-800/60', 'text-slate-300');

      // İçerik panellerini göster/gizle
      tabPanes.forEach(pane => {
        if (pane.id === `tabContent-${targetTab}`) {
          pane.classList.remove('hidden');
        } else {
          pane.classList.add('hidden');
        }
      });

      refreshIcons();

      // Sekmeye göre verileri tazele
      if (targetTab === 'dashboard') {
        loadDashboardData();
      } else if (targetTab === 'shifts') {
        loadShifts();
      } else if (targetTab === 'finance') {
        loadPayments();
      }
    });
  });
}

// ==========================================
// 2. DASHBOARD VERİLERİ VE GRAFİKLER
// ==========================================
async function loadDashboardData() {
  if (!checkAuth()) return;

  try {
    const res = await fetch('/api/stats/dashboard', {
      headers: getAuthHeaders()
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('adminToken');
      window.location.href = '/';
      return;
    }

    const data = await res.json();
    if (!data.success) return;

    lastDashboardData = data;

    // 1. Metrik Kartlarını Doldur
    const { stats, weeklyChart, categoryChart, timeline } = data;

    document.getElementById('statTotalShifts').textContent = stats.totalShifts;
    document.getElementById('statTodayActive').textContent = stats.todayActiveCount;
    document.getElementById('statTotalPayments').textContent = stats.totalPaymentsFormatted;
    document.getElementById('statThisMonthPayments').textContent = stats.thisMonthPaymentsFormatted;

    // Rozetleri güncelle
    const tabShiftsBadge = document.getElementById('tabShiftsBadge');
    if (tabShiftsBadge) tabShiftsBadge.textContent = stats.totalShifts;

    // 2. Haftalık Çalışma Çubuk Grafiği
    renderWeeklyChart(weeklyChart);

    // 3. Kategori Dağılım Grafiği
    renderCategoryChart(categoryChart);

    // 4. Zaman Çizelgesi
    renderTimeline(timeline);

    refreshIcons();
  } catch (error) {
    console.error('Dashboard yükleme hatası:', error);
  }
}

function renderWeeklyChart(weeklyData) {
  const canvas = document.getElementById('weeklyHoursChart');
  if (!canvas || !weeklyData) return;

  if (weeklyChartInstance) {
    weeklyChartInstance.destroy();
  }

  const isTr = (typeof i18n !== 'undefined' && i18n.getCurrentLang() === 'tr');
  const dayLabelsTr = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const dayLabelsEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthLabelsTr = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const monthLabelsEn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const labels = weeklyData.map(d => {
    const parsed = parseDateSafely(d.date) || new Date();
    const dayName = isTr ? dayLabelsTr[parsed.getDay()] : dayLabelsEn[parsed.getDay()];
    const monthName = isTr ? monthLabelsTr[parsed.getMonth()] : monthLabelsEn[parsed.getMonth()];
    return `${parsed.getDate()} ${monthName} (${dayName})`;
  });

  const hours = weeklyData.map(d => d.hours);

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.8)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.1)');

  weeklyChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: t('chart_weekly_hours_dataset'),
        data: hours,
        backgroundColor: gradient,
        borderColor: '#6366f1',
        borderWidth: 1.5,
        borderRadius: 8,
        barThickness: 24,
        maxBarThickness: 32
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: '#475569',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} ${t('chart_weekly_hours_tooltip')}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(51, 65, 85, 0.4)' },
          ticks: { 
            color: '#94a3b8', 
            font: { size: 11 }, 
            callback: (v) => `${v}${t('time_hour_short')}` 
          }
        }
      }
    }
  });
}

function renderCategoryChart(categoryData) {
  const canvas = document.getElementById('categoryDistributionChart');
  const emptyEl = document.getElementById('categoryChartEmpty');
  if (!canvas) return;

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
    categoryChartInstance = null;
  }

  if (!categoryData || categoryData.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.classList.add('hidden');
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  canvas.classList.remove('hidden');
  if (emptyEl) emptyEl.classList.add('hidden');

  const labels = categoryData.map(c => translateCategory(c.category));
  const data = categoryData.map(c => c.total);

  const colorMap = {
    'Maaş': '#6366f1',
    'Salary': '#6366f1',
    'Malzeme': '#059669',
    'Material': '#059669',
    'Diğer': '#64748b',
    'Other': '#64748b',
    'Malzeme/Gider': '#059669',
    'Material/Expense': '#059669',
    'Avans': '#f59e0b',
    'Advance': '#f59e0b',
    'Yemek/Yol': '#10b981',
    'Food/Travel': '#10b981',
    'Prim': '#a855f7',
    'Bonus': '#a855f7'
  };

  const colors = categoryData.map(c => colorMap[c.category] || '#6366f1');

  categoryChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#0f172a'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#cbd5e1',
            boxWidth: 10,
            font: { size: 11 },
            padding: 12
          }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          borderColor: '#475569',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatMoney(ctx.raw)}`
          }
        }
      }
    }
  });
}

function renderTimeline(timelineEvents) {
  const container = document.getElementById('timelineContainer');
  if (!container) return;

  if (!timelineEvents || timelineEvents.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 text-center py-6">${t('timeline_empty')}</div>`;
    return;
  }

  container.innerHTML = timelineEvents.map(event => {
    const isShift = event.type === 'shift';
    const iconName = isShift ? 'clock' : 'banknote';
    const bgClass = isShift ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
    const timeAgoStr = (typeof i18n !== 'undefined' && i18n.timeAgoI18n) ? i18n.timeAgoI18n(event.rawDate) : event.timeAgo;

    return `
      <div class="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition">
        <div class="w-8 h-8 rounded-lg ${bgClass} border flex items-center justify-center shrink-0 mt-0.5">
          <i data-lucide="${iconName}" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <h5 class="text-xs font-semibold text-slate-200 truncate">${event.title}</h5>
            <span class="text-[11px] text-slate-400 whitespace-nowrap">${timeAgoStr}</span>
          </div>
          <p class="text-xs text-slate-400 truncate mt-0.5">${event.description}</p>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 3. PERSONEL GİRİŞ-ÇIKIŞ (VARDİYA) YÖNETİMİ
// ==========================================
async function loadShifts() {
  if (!checkAuth()) return;

  const search = document.getElementById('shiftSearchInput')?.value || '';
  const workplace = document.getElementById('shiftWorkplaceFilter')?.value || '';
  const startDate = document.getElementById('shiftStartDate')?.value || '';
  const endDate = document.getElementById('shiftEndDate')?.value || '';

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (workplace) params.append('workplace', workplace);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  try {
    const res = await fetch(`/api/shifts?${params.toString()}`, {
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!data.success) return;

    currentShiftsData = data.data || [];

    // Özet bilgileri güncelle
    document.getElementById('shiftCountText').textContent = data.count;
    
    const formattedDuration = (typeof i18n !== 'undefined' && i18n.formatDurationI18n) 
      ? i18n.formatDurationI18n(Math.round(data.totalHours * 60)) 
      : `${data.totalHours} ${t('stat_hours_unit')}`;

    document.getElementById('shiftTotalHoursText').textContent = `${data.totalHours} ${t('stat_hours_unit')} (${formattedDuration})`;

    // Şantiye filtresini doldur
    populateWorkplaceFilter(currentShiftsData);

    // Tabloyu render et
    renderShiftsTable(currentShiftsData);
    refreshIcons();
  } catch (err) {
    console.error('Vardiyalar yüklenirken hata:', err);
  }
}

function populateWorkplaceFilter(shifts) {
  const filterSelect = document.getElementById('shiftWorkplaceFilter');
  if (!filterSelect || filterSelect.options.length > 1) return;

  const places = [...new Set(shifts.map(s => s.workplace).filter(Boolean))];
  places.forEach(place => {
    const opt = document.createElement('option');
    opt.value = place;
    opt.textContent = place;
    filterSelect.appendChild(opt);
  });
}

function renderShiftsTable(shifts) {
  const tbody = document.getElementById('shiftsTableBody');
  if (!tbody) return;

  if (shifts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-10 text-slate-400">
          <div class="flex flex-col items-center justify-center space-y-2">
            <i data-lucide="inbox" class="w-8 h-8 text-slate-500"></i>
            <span>${t('shifts_table_empty')}</span>
          </div>
        </td>
      </tr>
    `;
    refreshIcons();
    return;
  }

  tbody.innerHTML = shifts.map(shift => {
    const isActive = shift.status === 'active' || !shift.exit_time;
    const initials = (shift.employee_name || 'P').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const dateFormatted = formatDate(shift.entry_time);
    const entryTimeOnly = formatTimeOnly(shift.entry_time);
    const exitTimeOnly = isActive ? '<span class="text-slate-500 font-mono">-</span>' : `<span class="font-mono text-slate-200">${formatTimeOnly(shift.exit_time)}</span>`;
    
    const formattedDuration = (typeof i18n !== 'undefined' && i18n.formatDurationI18n) 
      ? i18n.formatDurationI18n(shift.duration_minutes) 
      : shift.durationFormatted;

    const durationBadge = isActive 
      ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block"></span> ${t('badge_in_progress')}</span>`
      : `<span class="px-2.5 py-1 rounded-md text-xs font-semibold ${shift.duration_minutes > 0 ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'} whitespace-nowrap">${formattedDuration}</span>`;

    // GPS Harita Bağlantısı
    const hasLocation = shift.entry_latitude !== null && shift.entry_latitude !== undefined && shift.entry_longitude !== null && shift.entry_longitude !== undefined && !isNaN(shift.entry_latitude) && !isNaN(shift.entry_longitude);
    const locationBadge = hasLocation
      ? `<a href="https://www.google.com/maps?q=${shift.entry_latitude},${shift.entry_longitude}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 text-xs transition font-medium" title="Google Maps (${Number(shift.entry_latitude).toFixed(4)}, ${Number(shift.entry_longitude).toFixed(4)})">
          <i data-lucide="map-pin" class="w-3.5 h-3.5 text-indigo-400"></i>
          <span>${t('btn_view_map')}</span>
        </a>`
      : `<span class="text-slate-600 font-mono text-xs">-</span>`;

    return `
      <tr class="hover:bg-slate-900/40 transition">
        <!-- Tarih -->
        <td class="py-3.5 px-4 font-medium text-slate-200 whitespace-nowrap">
          ${dateFormatted}
        </td>

        <!-- Çalışan Adı -->
        <td class="py-3.5 px-4">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
              ${initials}
            </div>
            <span class="font-semibold text-white whitespace-nowrap">${shift.employee_name}</span>
          </div>
        </td>

        <!-- Çalışma Yeri -->
        <td class="py-3.5 px-4">
          <span class="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 whitespace-nowrap">
            ${shift.workplace}
          </span>
        </td>

        <!-- Konum (GPS) -->
        <td class="py-3.5 px-4 whitespace-nowrap">
          ${locationBadge}
        </td>

        <!-- Giriş Saati -->
        <td class="py-3.5 px-4 font-mono text-emerald-400 whitespace-nowrap">
          ${entryTimeOnly}
        </td>

        <!-- Çıkış Saati -->
        <td class="py-3.5 px-4 whitespace-nowrap">
          ${exitTimeOnly}
        </td>

        <!-- Toplam Süre / Durum -->
        <td class="py-3.5 px-4 whitespace-nowrap">
          ${durationBadge}
        </td>

        <!-- Notlar -->
        <td class="py-3.5 px-4 text-slate-400 max-w-xs truncate" title="${shift.notes || ''}">
          ${shift.notes || '<span class="text-slate-600">-</span>'}
        </td>

        <!-- İşlemler -->
        <td class="py-3.5 px-4 text-right whitespace-nowrap no-print">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="openEditShiftModal(${shift.id})" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 border border-slate-700" title="Düzenle">
              <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="deleteShift(${shift.id}, '${shift.employee_name}')" class="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20" title="Sil">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Vardiya Silme
window.deleteShift = async function(id, name) {
  const confirmResult = await Swal.fire({
    title: t('swal_delete_shift_title'),
    text: t('swal_delete_shift_text', name),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#475569',
    confirmButtonText: t('swal_btn_yes_delete'),
    cancelButtonText: t('btn_cancel'),
    background: '#1e293b',
    color: '#f8fafc'
  });

  if (!confirmResult.isConfirmed) return;

  try {
    const res = await fetch(`/api/shifts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: t('swal_deleted'),
        text: t('swal_shift_deleted_msg'),
        timer: 1500,
        showConfirmButton: false,
        background: '#1e293b',
        color: '#f8fafc'
      });
      loadShifts();
      loadDashboardData();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: data.message,
        background: '#1e293b',
        color: '#f8fafc'
      });
    }
  } catch (err) {
    console.error('Silme hatası:', err);
  }
};

// Manuel Vardiya Ekleme / Düzenleme Modalı
window.openEditShiftModal = function(id) {
  const shift = currentShiftsData.find(s => s.id === id);
  if (!shift) return;

  document.getElementById('shiftModalTitle').textContent = t('modal_manual_shift_edit_title');
  document.getElementById('modalShiftId').value = shift.id;
  document.getElementById('modalEmployeeName').value = shift.employee_name;
  document.getElementById('modalWorkplace').value = shift.workplace;
  document.getElementById('modalEntryTime').value = toLocalInputString(shift.entry_time);
  document.getElementById('modalExitTime').value = toLocalInputString(shift.exit_time);
  document.getElementById('modalNotes').value = shift.notes || '';

  document.getElementById('shiftModal').classList.remove('hidden');
  refreshIcons();
};

function openNewShiftModal() {
  document.getElementById('shiftModalTitle').textContent = t('modal_manual_shift_title');
  document.getElementById('modalShiftId').value = '';
  document.getElementById('modalShiftForm').reset();
  document.getElementById('modalEntryTime').value = toLocalInputString(new Date());

  document.getElementById('shiftModal').classList.remove('hidden');
  refreshIcons();
}

function closeShiftModal() {
  document.getElementById('shiftModal').classList.add('hidden');
}

// ==========================================
// 4. FİNANS VE ÖDEME YÖNETİMİ
// ==========================================
async function loadPayments() {
  if (!checkAuth()) return;

  const search = document.getElementById('paymentSearchInput')?.value || '';
  const category = document.getElementById('paymentCategoryFilter')?.value || '';
  const method = document.getElementById('paymentMethodFilter')?.value || '';

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (category) params.append('category', category);
  if (method) params.append('method', method);

  try {
    const res = await fetch(`/api/payments?${params.toString()}`, {
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!data.success) return;

    currentPaymentsData = data.data || [];

    // Özet kartlarını güncelle
    document.getElementById('financeSummaryTotal').textContent = data.totalAmountFormatted;
    document.getElementById('financeSummaryCount').textContent = `${data.count} ${t('transactions_count_suffix')}`;

    // Cari ay kazancını/gelirini hesapla
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyIncome = currentPaymentsData
      .filter(p => p.payment_date && p.payment_date.startsWith(currentMonth))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    document.getElementById('financeSummaryThisMonth').textContent = formatMoney(monthlyIncome);

    renderPaymentsTable(currentPaymentsData);
    refreshIcons();
  } catch (err) {
    console.error('Ödemeler yüklenirken hata:', err);
  }
}

function renderPaymentsTable(payments) {
  const tbody = document.getElementById('paymentsTableBody');
  if (!tbody) return;

  if (payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-8 text-slate-400">
          ${t('payments_table_empty')}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = payments.map(pay => {
    let catClass = 'badge-category-diger';
    if (pay.category === 'Maaş' || pay.category === 'Salary') catClass = 'badge-category-maas';
    else if (pay.category === 'Avans' || pay.category === 'Advance') catClass = 'badge-category-avans';
    else if (pay.category === 'Malzeme' || pay.category === 'Material' || pay.category === 'Malzeme/Gider' || pay.category === 'Material/Expense') catClass = 'badge-category-malzeme';
    else if (pay.category === 'Yemek/Yol' || pay.category === 'Food/Travel') catClass = 'badge-category-yemek';
    else if (pay.category === 'Prim' || pay.category === 'Bonus') catClass = 'badge-category-prim';

    return `
      <tr class="hover:bg-slate-900/40 transition">
        <!-- Tarih -->
        <td class="py-3 px-3 font-medium text-slate-200 whitespace-nowrap">
          ${formatDate(pay.payment_date)}
        </td>

        <!-- Ödeme Yapan / Alan -->
        <td class="py-3 px-3 font-semibold text-white whitespace-nowrap">
          ${pay.recipient}
        </td>

        <!-- Kategori -->
        <td class="py-3 px-3 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded-md text-[11px] font-semibold ${catClass}">
            ${translateCategory(pay.category)}
          </span>
        </td>

        <!-- Yöntem -->
        <td class="py-3 px-3 text-slate-300 text-xs whitespace-nowrap">
          ${pay.payment_method || 'Nakit'}
        </td>

        <!-- Tutar -->
        <td class="py-3 px-3 font-bold font-mono text-amber-300 whitespace-nowrap">
          ${pay.amountFormatted}
        </td>

        <!-- Not -->
        <td class="py-3 px-3 text-slate-400 max-w-[160px] truncate" title="${pay.notes || ''}">
          ${pay.notes || '<span class="text-slate-600">-</span>'}
        </td>

        <!-- İşlem -->
        <td class="py-3 px-3 text-right whitespace-nowrap no-print">
          <button onclick="deletePayment(${pay.id}, '${pay.recipient}', '${pay.amountFormatted}')" class="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20" title="Sil">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Ödeme Silme
window.deletePayment = async function(id, recipient, amountFormatted) {
  const confirmResult = await Swal.fire({
    title: t('swal_delete_payment_title'),
    text: t('swal_delete_payment_text', [recipient, amountFormatted]),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#475569',
    confirmButtonText: t('swal_btn_yes_delete'),
    cancelButtonText: t('btn_cancel'),
    background: '#1e293b',
    color: '#f8fafc'
  });

  if (!confirmResult.isConfirmed) return;

  try {
    const res = await fetch(`/api/payments/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: t('swal_deleted'),
        text: t('swal_payment_deleted_msg'),
        timer: 1500,
        showConfirmButton: false,
        background: '#1e293b',
        color: '#f8fafc'
      });
      loadPayments();
      loadDashboardData();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: data.message,
        background: '#1e293b',
        color: '#f8fafc'
      });
    }
  } catch (err) {
    console.error('Ödeme silme hatası:', err);
  }
};

// ==========================================
// 5. EXCEL / CSV DIŞA AKTARMA VE YAZDIRMA
// ==========================================
function exportShiftsToCSV() {
  if (currentShiftsData.length === 0) {
    Swal.fire({ icon: 'info', title: t('swal_no_data_title'), text: t('swal_no_data_export'), background: '#1e293b', color: '#f8fafc' });
    return;
  }

  const isTr = (typeof i18n !== 'undefined' && i18n.getCurrentLang() === 'tr');
  const headers = isTr
    ? ['ID', 'Tarih', 'Çalışan Adı Soyadı', 'Çalışma Yeri / Şantiye', 'Konum (Google Maps)', 'Giriş Saati', 'Çıkış Saati', 'Toplam Süre (Dakika)', 'Hesaplanan Süre', 'Notlar']
    : ['ID', 'Date', 'Employee Full Name', 'Workplace / Site', 'Location (Google Maps)', 'Check-in Time', 'Check-out Time', 'Duration (Minutes)', 'Formatted Duration', 'Notes'];

  const rows = currentShiftsData.map(s => [
    s.id,
    formatDate(s.entry_time),
    `"${(s.employee_name || '').replace(/"/g, '""')}"`,
    `"${(s.workplace || '').replace(/"/g, '""')}"`,
    (s.entry_latitude && s.entry_longitude) ? `"https://www.google.com/maps?q=${s.entry_latitude},${s.entry_longitude}"` : '"-"',
    s.entry_time ? s.entry_time.replace('T', ' ') : '',
    (s.status === 'active' || !s.exit_time) ? '-' : s.exit_time.replace('T', ' '),
    s.duration_minutes || 0,
    `"${(s.status === 'active' || !s.exit_time) ? t('badge_in_progress') : (i18n.formatDurationI18n ? i18n.formatDurationI18n(s.duration_minutes) : s.durationFormatted)}"`,
    `"${(s.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
  downloadFile(csvContent, `Shift_Report_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
}

function exportPaymentsToCSV() {
  if (currentPaymentsData.length === 0) {
    Swal.fire({ icon: 'info', title: t('swal_no_data_title'), text: t('swal_no_data_export'), background: '#1e293b', color: '#f8fafc' });
    return;
  }

  const isTr = (typeof i18n !== 'undefined' && i18n.getCurrentLang() === 'tr');
  const headers = isTr
    ? ['ID', 'Ödeme Tarihi', 'Ödeme Yapan / Alan', 'Kategori', 'Ödeme Yöntemi', 'Tutar (CAD$)', 'Açıklama']
    : ['ID', 'Payment Date', 'Paid To / Recipient', 'Category', 'Payment Method', 'Amount (CAD$)', 'Notes'];

  const rows = currentPaymentsData.map(p => [
    p.id,
    formatDate(p.payment_date),
    `"${(p.recipient || '').replace(/"/g, '""')}"`,
    `"${translateCategory(p.category)}"`,
    `"${p.payment_method || 'Nakit'}"`,
    p.amount,
    `"${(p.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
  downloadFile(csvContent, `Payment_Report_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ==========================================
// 6. DİL DEĞİŞİKLİĞİ DİNLEYİCİSİ
// ==========================================
window.addEventListener('languageChanged', () => {
  const activeTabBtn = document.querySelector('.tab-btn.active');
  const targetTab = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : 'dashboard';

  if (targetTab === 'dashboard' && lastDashboardData) {
    renderWeeklyChart(lastDashboardData.weeklyChart);
    renderCategoryChart(lastDashboardData.categoryChart);
    renderTimeline(lastDashboardData.timeline);
  } else if (targetTab === 'shifts' && currentShiftsData.length > 0) {
    renderShiftsTable(currentShiftsData);
  } else if (targetTab === 'finance' && currentPaymentsData.length > 0) {
    renderPaymentsTable(currentPaymentsData);
  }
});

// ==========================================
// 7. BAŞLATICI VE OLAY DİNLEYİCİLERİ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;

  refreshIcons();
  setupTabs();
  loadDashboardData();

  // Yönetici Kullanıcı Adını Göster
  const adminUserStr = localStorage.getItem('adminUser');
  if (adminUserStr) {
    try {
      const user = JSON.parse(adminUserStr);
      const nameEl = document.getElementById('adminDisplayName');
      if (nameEl) nameEl.textContent = user.fullName || user.username || 'Yönetici';
    } catch(e){}
  }

  // Çıkış Butonu
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      window.location.href = '/';
    });
  }

  // Dashboard Yenile
  const refreshDashboardBtn = document.getElementById('refreshDashboardBtn');
  if (refreshDashboardBtn) {
    refreshDashboardBtn.addEventListener('click', () => {
      loadDashboardData();
    });
  }

  // Hızlı Butonlar
  document.getElementById('quickAddPaymentBtn')?.addEventListener('click', () => {
    document.querySelector('[data-tab="finance"]')?.click();
  });

  document.getElementById('quickAddShiftBtn')?.addEventListener('click', () => {
    document.querySelector('[data-tab="shifts"]')?.click();
    openNewShiftModal();
  });

  document.getElementById('quickExportShiftsBtn')?.addEventListener('click', exportShiftsToCSV);

  // Vardiya Filtre Dinleyicileri
  const shiftSearchInput = document.getElementById('shiftSearchInput');
  const shiftWorkplaceFilter = document.getElementById('shiftWorkplaceFilter');
  const shiftStartDate = document.getElementById('shiftStartDate');
  const shiftEndDate = document.getElementById('shiftEndDate');
  const resetShiftFiltersBtn = document.getElementById('resetShiftFiltersBtn');

  if (shiftSearchInput) shiftSearchInput.addEventListener('input', debounce(loadShifts, 300));
  if (shiftWorkplaceFilter) shiftWorkplaceFilter.addEventListener('change', loadShifts);
  if (shiftStartDate) shiftStartDate.addEventListener('change', loadShifts);
  if (shiftEndDate) shiftEndDate.addEventListener('change', loadShifts);

  if (resetShiftFiltersBtn) {
    resetShiftFiltersBtn.addEventListener('click', () => {
      if (shiftSearchInput) shiftSearchInput.value = '';
      if (shiftWorkplaceFilter) shiftWorkplaceFilter.value = '';
      if (shiftStartDate) shiftStartDate.value = '';
      if (shiftEndDate) shiftEndDate.value = '';
      loadShifts();
    });
  }

  // Manuel Vardiya Modalı Dinleyicileri
  document.getElementById('addManualShiftBtn')?.addEventListener('click', openNewShiftModal);
  document.getElementById('closeShiftModalBtn')?.addEventListener('click', closeShiftModal);
  document.getElementById('cancelShiftModalBtn')?.addEventListener('click', closeShiftModal);
  document.getElementById('exportShiftsCsvBtn')?.addEventListener('click', exportShiftsToCSV);
  document.getElementById('printShiftsBtn')?.addEventListener('click', () => window.print());

  // Manuel Vardiya Formu Gönderimi
  const modalShiftForm = document.getElementById('modalShiftForm');
  if (modalShiftForm) {
    modalShiftForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('modalShiftId').value;
      const employee_name = document.getElementById('modalEmployeeName').value.trim();
      const workplace = document.getElementById('modalWorkplace').value.trim();
      const entry_time = document.getElementById('modalEntryTime').value;
      const exit_time = document.getElementById('modalExitTime').value || null;
      const notes = document.getElementById('modalNotes').value.trim();

      const url = id ? `/api/shifts/${id}` : '/api/shifts/admin';
      const method = id ? 'PUT' : 'POST';

      try {
        const res = await fetch(url, {
          method,
          headers: getAuthHeaders(),
          body: JSON.stringify({ employee_name, workplace, entry_time, exit_time, notes })
        });

        const data = await res.json();
        if (data.success) {
          closeShiftModal();
          Swal.fire({
            icon: 'success',
            title: t('swal_deleted') ? 'OK' : 'Başarılı',
            text: data.message,
            timer: 1500,
            showConfirmButton: false,
            background: '#1e293b',
            color: '#f8fafc'
          });
          loadShifts();
          loadDashboardData();
        } else {
          Swal.fire({ icon: 'error', title: 'Error', text: data.message, background: '#1e293b', color: '#f8fafc' });
        }
      } catch (err) {
        console.error('Vardiya kaydetme hatası:', err);
      }
    });
  }

  // Finans Formu ve Filtre Dinleyicileri
  const paymentDateInput = document.getElementById('paymentDate');
  if (paymentDateInput) {
    paymentDateInput.value = new Date().toISOString().slice(0, 10);
  }

  document.getElementById('setPaymentTodayBtn')?.addEventListener('click', () => {
    if (paymentDateInput) paymentDateInput.value = new Date().toISOString().slice(0, 10);
  });

  const paymentSearchInput = document.getElementById('paymentSearchInput');
  const paymentCategoryFilter = document.getElementById('paymentCategoryFilter');
  const paymentMethodFilter = document.getElementById('paymentMethodFilter');

  if (paymentSearchInput) paymentSearchInput.addEventListener('input', debounce(loadPayments, 300));
  if (paymentCategoryFilter) paymentCategoryFilter.addEventListener('change', loadPayments);
  if (paymentMethodFilter) paymentMethodFilter.addEventListener('change', loadPayments);
  document.getElementById('exportPaymentsCsvBtn')?.addEventListener('click', exportPaymentsToCSV);

  // Yeni Ödeme Formu Gönderimi
  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) {
    paymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const payment_date = document.getElementById('paymentDate').value;
      const amount = parseFloat(document.getElementById('paymentAmount').value);
      const recipient = document.getElementById('paymentRecipient').value.trim();
      const category = document.getElementById('paymentCategory').value;
      const payment_method = document.getElementById('paymentMethod').value;
      const notes = document.getElementById('paymentNotes').value.trim();

      if (!payment_date || isNaN(amount) || !recipient || !category) {
        Swal.fire({ icon: 'warning', title: t('swal_missing_info'), text: t('swal_fill_required'), background: '#1e293b', color: '#f8fafc' });
        return;
      }

      try {
        const res = await fetch('/api/payments', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ payment_date, amount, recipient, category, payment_method, notes })
        });

        const data = await res.json();
        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: t('swal_payment_saved_title'),
            text: t('swal_payment_saved_msg', [recipient, data.amountFormatted]),
            timer: 1800,
            showConfirmButton: false,
            background: '#1e293b',
            color: '#f8fafc'
          });

          paymentForm.reset();
          if (paymentDateInput) paymentDateInput.value = new Date().toISOString().slice(0, 10);
          loadPayments();
          loadDashboardData();
        } else {
          Swal.fire({ icon: 'error', title: 'Error', text: data.message, background: '#1e293b', color: '#f8fafc' });
        }
      } catch (err) {
        console.error('Ödeme ekleme hatası:', err);
      }
    });
  }

  // Şifre Değiştirme Modalı
  const changePassModal = document.getElementById('changePassModal');
  document.getElementById('openChangePassBtn')?.addEventListener('click', () => {
    changePassModal?.classList.remove('hidden');
    refreshIcons();
  });
  document.getElementById('closeChangePassModalBtn')?.addEventListener('click', () => changePassModal?.classList.add('hidden'));
  document.getElementById('cancelChangePassBtn')?.addEventListener('click', () => changePassModal?.classList.add('hidden'));

  document.getElementById('changePassForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();
      if (data.success) {
        changePassModal.classList.add('hidden');
        document.getElementById('changePassForm').reset();
        Swal.fire({
          icon: 'success',
          title: t('swal_password_updated_title'),
          text: t('swal_password_updated_msg'),
          background: '#1e293b',
          color: '#f8fafc'
        });
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: data.message, background: '#1e293b', color: '#f8fafc' });
      }
    } catch (err) {
      console.error('Şifre değiştirme hatası:', err);
    }
  });
});

// Debounce Yardımcısı (Arama kutusu geciktirici)
function debounce(func, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}
