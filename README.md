# 🚀 Personel Takip ve Finans Yönetim Sistemi (Workspace)

İşletmeler ve şantiyeler için özel olarak tasarlanmış, kodlama bilgisi gerektirmeyen, modern, Türkçe arayüzlü ve tam fonksiyonel Personel Takip ve Finans Yönetim Sistemi.

---

## 🌟 Öne Çıkan Özellikler

### 1. 👥 Çalışan Giriş / Çıkış Portali (`/`)
- **Hızlı Giriş:** Çalışan adı, şantiye/bölüm, giriş ve çıkış saatleri.
- **⚡ "Şimdi" Butonları:** Giriş ve çıkış anında tek tıkla sistemin anlık tarih ve saatini otomatik doldurur.
- **Otomatik Süre Hesaplama:** Giriş ve çıkış saatleri arasındaki net çalışma süresini anlık hesaplar ve gösterir.
- **Vardiya Notları:** Yapılan işlerin ve detayların yazıldığı açıklama alanı.
- **Akıllı Tamamlama:** Daha önce girilen çalışan ve şantiye isimlerini otomatik önerir.
- **Şık Bildirimler:** SweetAlert2 ile modern onay kutuları ve anlık durum rozetleri.

### 2. 🔒 Güvenli Yönetici Girişi
- **Varsayılan Kullanıcı Adı:** `admin`
- **Varsayılan Şifre:** `admin123`
- JWT tabanlı güvenli oturum yönetimi.
- Yönetici panelinden kolay şifre değiştirme yeteneği.

### 3. 📊 Yönetici Kontrol Paneli (`/admin`)
- **Bölüm A: Özet ve Dashboard Metrikleri:**
  - Toplam Vardiya Kaydı Sayısı
  - Bugün Çalışan Aktif Personel Sayısı
  - Toplam Yapılan Ödeme Tutarı (CAD$)
  - Bu Ay Yapılan Toplam Kasa Çıkışı (CAD$)
  - Son 7 Günlük Çalışma Saati Çubuk Grafiği (Chart.js)
  - Finans / Gider Kategori Dağılım Grafiği (Chart.js)
  - Anlık Karma Zaman Çizelgesi (Timeline)
- **Bölüm B: Personel Giriş-Çıkış Kayıtları Tablosu:**
  - Personele, şantiyeye ve tarih aralığına göre anlık filtreleme ve arama.
  - Çalışma süreleri dökümü ve toplam saat hesaplama.
  - Excel (CSV) formatında rapor indirme.
  - Doğrudan Yazdırma (PDF/Print) desteği.
  - Manuel vardiya ekleme, düzenleme ve silme.
- **Bölüm C: Finans / Ödeme Yönetimi:**
  - Yeni Ödeme Kaydı Ekleme (Maaş, Avans, Malzeme/Gider, Yemek/Yol, Prim, Diğer).
  - Ödeme yöntemleri (Nakit, Banka/Havale, Kredi Kartı).
  - Filtrelenebilir ödeme geçmişi tablosu, toplam harcama dökümleri ve Excel (CSV) çıktısı.

---

## 💻 Nasıl Çalıştırılır?

### Yöntem 1: Tek Tıkla Başlatma (En Kolay)
Klasör içindeki **`start.bat`** dosyasına çift tıklayın.
- Sunucu otomatik başlar ve varsayılan tarayıcınızda `http://localhost:3000` sayfası otomatik açılır.

### Yöntem 2: Komut Satırından Başlatma
1. Terminal / Komut Satırını bu klasörde açın.
2. Bağımlılıkları yüklemek için:
   ```bash
   npm install
   ```
3. Sunucuyu başlatmak için:
   ```bash
   npm start
   ```
4. Tarayıcınızda açın:
   - **Çalışan Portali:** `http://localhost:3000`
   - **Yönetici Paneli:** `http://localhost:3000/admin`

---

## 🗄️ Veritabanı ve Yedekleme
- Sistem yerel **SQLite** veritabanı kullanır (`data/giriscikis.db`).
- Harici bir veritabanı sunucusu (MySQL, PostgreSQL vb.) kurulumu gerektirmez.
- Tüm veriler tek bir dosya içinde güvenle saklanır. Yedek almak için sadece `data` klasörünü kopyalamanız yeterlidir.

---

## 🛠️ Teknoloji Yığını
- **Backend:** Node.js (v24 LTS) + Express.js + `node:sqlite`
- **Frontend:** HTML5, Tailwind CSS, Vanilla JavaScript
- **İkonlar:** Lucide Icons
- **Bildirimler:** SweetAlert2
- **Grafikler:** Chart.js
