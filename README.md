# Shopify Product Configurator

React/Remix tabanlı dinamik ürün konfigürasyon uygula## Workflowlanıcılar boy, en ve materyal seçerek özel ürünler oluşturabilir, hesaplanan fiyatla sepete ekleyebilir.



##  Kurulum

```bash
npm install
npm run dev
```

##  Kullanım

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

##  Teknik Detaylar

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

##  Proje Yapısı

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

##  API Endpoints

- `POST /apps/configurator/add-to-cart` - Sepete ekleme
- `POST /apps/cleanup/manual` - Manuel temizlik
- `GET /apps/task-overview` - Sistem durumu
- `POST /apps/test/*` - Test endpoints

##  Güvenlik

- Geçici ürünler DRAFT durumunda
- Metafield tabanlı güvenli veri saklama
- API rate limiting koruması
- Sipariş güvenliği (silinse bile order korunur)

##  Monitoring

- Gerçek zamanlı sistem sağlık durumu
- Operasyon logları ve metrikler
- Hata takibi ve alerting
- Performance monitoring


##  Workflow

1. **Kullanıcı konfigürasyon yapar** → Gerçek zamanlı fiyat hesaplanır
2. **Sepete ekle tıklanır** → Geçici ürün oluşturulur
3. **Sepete yönlendirilir** → Konfigürasyon detayları görünür
4. **2 saat sonra** → Otomatik temizlik çalışır
5. **24 saat sonra** → Güvenlik taraması yapılır
