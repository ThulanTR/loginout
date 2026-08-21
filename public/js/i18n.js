// ==============================================================
// DİL YÖNETİCİSİ (i18n ENGINE)
// ==============================================================

(function () {
  let currentLang = localStorage.getItem('app_lang') || 'tr';
  if (currentLang !== 'tr' && currentLang !== 'en') {
    currentLang = 'tr';
  }

  // Çeviri Getirici
  function t(key, params) {
    const dict = (typeof translations !== 'undefined' && translations[currentLang]) 
      ? translations[currentLang] 
      : (typeof translations !== 'undefined' && translations['tr'] ? translations['tr'] : {});

    let text = dict[key] !== undefined ? dict[key] : key;

    if (params) {
      if (Array.isArray(params)) {
        params.forEach((val, idx) => {
          text = text.replace(new RegExp(`\\{${idx}\\}`, 'g'), val);
        });
      } else if (typeof params === 'object') {
        Object.keys(params).forEach(k => {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
        });
      } else {
        text = text.replace(/\{0\}/g, params);
      }
    }

    return text;
  }

  // Geçerli Dili Al
  function getCurrentLang() {
    return currentLang;
  }

  // Dil Değiştir ve DOM'u Güncelle
  function setLanguage(lang) {
    if (lang !== 'tr' && lang !== 'en') lang = 'tr';
    currentLang = lang;
    localStorage.setItem('app_lang', lang);
    document.documentElement.lang = lang;

    // 1. Text & HTML İçerikleri ([data-i18n])
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.innerHTML = t(key);
      }
    });

    // 2. Placeholder Alanları ([data-i18n-placeholder])
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.setAttribute('placeholder', t(key));
      }
    });

    // 3. Title ve Tooltip Alanları ([data-i18n-title])
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.setAttribute('title', t(key));
      }
    });

    // 4. Value Değerleri ([data-i18n-value])
    document.querySelectorAll('[data-i18n-value]').forEach(el => {
      const key = el.getAttribute('data-i18n-value');
      if (key) {
        el.value = t(key);
      }
    });

    // 5. Dil Butonlarının Aktiflik Durumunu Güncelle
    updateLanguageButtons();

    // 6. Sayfaya dil değişikliği olayını bildir
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: currentLang } }));

    // 7. İkonları Yenile
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // Dil Butonlarının Görsel Durumu
  function updateLanguageButtons() {
    const trBtns = document.querySelectorAll('.lang-btn-tr, #lang-btn-tr');
    const enBtns = document.querySelectorAll('.lang-btn-en, #lang-btn-en');

    trBtns.forEach(btn => {
      if (currentLang === 'tr') {
        btn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
        btn.classList.remove('text-slate-400', 'hover:text-white', 'hover:text-slate-200');
      } else {
        btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
        btn.classList.add('text-slate-400', 'hover:text-white');
      }
    });

    enBtns.forEach(btn => {
      if (currentLang === 'en') {
        btn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
        btn.classList.remove('text-slate-400', 'hover:text-white', 'hover:text-slate-200');
      } else {
        btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
        btn.classList.add('text-slate-400', 'hover:text-white');
      }
    });
  }

  // Süre Formatlayıcı
  function formatDurationI18n(minutes) {
    if (minutes === undefined || minutes === null || minutes < 0) return t('badge_in_progress');
    if (minutes === 0) return t('time_less_than_minute');
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours} ${t('time_hour_short')} ${mins} ${t('time_minute_short')}`;
    if (hours > 0) return `${hours} ${t('time_hours')}`;
    return `${mins} ${t('time_minutes')}`;
  }

  // Zaman Farkı Formatlayıcı (timeAgo)
  function timeAgoI18n(dateString) {
    if (!dateString) return '';
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return t('time_just_now');
    if (diffMinutes < 60) return t('time_mins_ago', diffMinutes);
    if (diffHours < 24) return t('time_hours_ago', diffHours);
    if (diffDays === 1) return t('time_yesterday');
    if (diffDays < 30) return t('time_days_ago', diffDays);
    return past.toLocaleDateString(currentLang === 'tr' ? 'tr-TR' : 'en-US');
  }

  // Global Scope'a Bağla
  window.i18n = {
    t,
    setLanguage,
    getCurrentLang,
    formatDurationI18n,
    timeAgoI18n
  };
  window.t = t;
  window.setLanguage = setLanguage;

  // Sayfa Yüklendiğinde Otomatik Başlat
  document.addEventListener('DOMContentLoaded', () => {
    setLanguage(currentLang);
  });
})();

