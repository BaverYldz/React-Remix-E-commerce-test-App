# Shopify Product Configurator

React/Remix tabanlı dinamik ürün konfigürasyon uygulaması. Kullanıcılar boy, en ve materyal seçerek özel ürünler oluşturabilir, hesaplanan fiyatla sepete ekleyebilir.

## 🚀 Özellikler

### Ürün Konfigürasyonu
- **Dinamik Form**: Boy, en ve materyal seçimi
- **Gerçek Zamanlı Fiyatlandırma**: Seçimlere göre anında fiyat hesaplama
- **Materyal Seçenekleri**: Ahşap, Metal, PVC, Cam
- **Alan Hesaplama**: Boyut tabanlı katsayı sistemi

### Tema Entegrasyonu
- **Theme App Extension**: Ürün sayfalarına entegre blok
- **Mevcut Varyant Gizleme**: Standart varyant seçicilerinin devre dışı bırakılması
- **Responsive Tasarım**: Mobil ve masaüstü uyumlu

### Sepet Yönetimi
- **Geçici Ürün Oluşturma**: Özel konfigürasyonlar için dinamik varyant oluşturma
- **Otomatik Sepet Ekleme**: Hesaplanan fiyat ve detaylarla sepete ekleme
- **Özel Properties**: Konfigürasyon bilgilerinin sepet notlarında saklanması

### Otomatik Temizlik Sistemi
- **2 Saat Otomatik Silme**: Geçici ürünlerin zaman tabanlı temizliği
- **Metafield Takibi**: Silme zamanı ve durumun saklanması
- **Güvenli Silme**: Sipariş verilmiş ürünlerin korunması
- **Günlük Tarama**: 24 saatlik güvenlik taraması

### Görünürlük Kontrolü
- **Vitrin Gizleme**: Geçici ürünlerin katalogda görünmemesi
- **SEO Optimizasyonu**: Search engine'lerden gizleme
- **Tag Yönetimi**: Otomatik etiketleme sistemi

### Hata Yönetimi
- **Retry Mekanizması**: Başarısız işlemlerde otomatik yeniden deneme
- **Kullanıcı Bildirimleri**: Anlaşılır hata mesajları
- **Duplicate Prevention**: Çoklu ürün oluşturma engelleme
- **Rate Limiting**: API çağrı sınırlandırması

### İzleme ve Logging
- **Operasyon Kayıtları**: Tüm işlemlerin detaylı loglanması
- **Sistem Sağlık Kontrolü**: Otomatik durum takibi
- **Alert Sistemi**: Kritik hataların bildirilmesi
- **Dashboard**: Admin panel entegrasyonu

## 🛠️ Kurulum

```bash
npm install
npm run dev
```

## 📋 Kullanım

1. **Uygulama Kurulumu**
   - Shopify admin panelinden uygulamayı kurun
   - Theme editor'de product sayfasına blok ekleyin

2. **Ürün Konfigürasyonu**
   - Ürün sayfasında boy ve en değerlerini girin
   - Materyal seçimi yapın
   - Hesaplanan fiyatı kontrol edin

3. **Sepete Ekleme**
   - "Sepete Ekle" butonuna tıklayın
   - Konfigürasyon detayları ile sepete yönlendirileceksiniz

## 🎯 Teknik Detaylar

### Fiyat Hesaplama
```javascript
// Alan bazlı katsayı sistemi
const areaMultiplier = area < 0.1 ? 1.5 : 
                      area < 0.5 ? 1.2 :
                      area < 2 ? 1.0 :
                      area < 5 ? 0.9 : 0.8;

const price = area * materialPrice * areaMultiplier;
```

### Materyal Fiyatları
- **Ahşap**: 25₺/m²
- **Metal**: 35₺/m²  
- **PVC**: 20₺/m²
- **Cam**: 45₺/m²

### Otomatik Temizlik
- **İlk temizlik**: 2 saat sonra
- **Günlük tarama**: 24 saat+ eski ürünler
- **5 dakika aralıklarla** kontrol

## 📁 Proje Yapısı

```
app/
├── routes/
│   ├── apps.task-overview.jsx         # Ana dashboard
│   ├── apps.cleanup-scheduler.jsx     # Temizlik yönetimi
│   └── apps.configurator.*.jsx        # Konfigüratör endpoints
├── cleanup-system.js                  # Otomatik temizlik sistemi
├── product-visibility-manager.js      # Görünürlük kontrolü
├── error-handler.js                   # Hata yönetimi
├── operation-monitor.js               # İzleme sistemi
└── shopify.server.js                  # Shopify entegrasyonu

extensions/
└── product-configurator/
    ├── blocks/
    │   └── product-configurator.liquid # Theme extension
    └── shopify.extension.toml          # Extension yapılandırması
```

## 🔧 API Endpoints

- `POST /apps/configurator/add-to-cart` - Sepete ekleme
- `POST /apps/cleanup/manual` - Manuel temizlik
- `GET /apps/task-overview` - Sistem durumu