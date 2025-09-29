// Task 9-10 Test Senaryoları

/**
 * TEST ADIMLARI
 * 
 * Task 9: Geçici ürün oluşturma
 * Task 10: Sepete ekleme + kullanıcı bilgileri iliştirme
 */

console.log("🎯 TASK 9-10 TEST REHBERİ");
console.log("========================");

console.log("\n📋 TEST ADIMLARI:");

console.log("\n1️⃣ FRONTEND TESTİ:");
console.log("   • Tema editöründe ürün sayfasına git");
console.log("   • Özel Ürün Konfigüratörü bloğunu ekle");
console.log("   • Test değerleri gir:");
console.log("     - Boy: 100 cm");
console.log("     - En: 150 cm");
console.log("     - Materyal: Ahşap");
console.log("   • 'Sepete Ekle' butonuna tıkla");

console.log("\n2️⃣ BEKLENİLEN DAVRANIŞLAR:");

console.log("\n✅ Task 9 - Geçici Ürün Oluşturma:");
console.log("   • Ürün başlığı: 'Özel Çerçeve 100×150cm - Ahşap'");
console.log("   • Ürün durumu: DRAFT (vitrine çıkmaz)");
console.log("   • Etiketler: 'geçici-ürün', 'özel-ölçü', 'expires-XXX'");
console.log("   • Fiyat: 0.15 m² × 25₺ × 1.2 = 4.50₺");
console.log("   • Açıklama: Boy, En, Materyal bilgileri");

console.log("\n✅ Task 10 - Sepete Ekleme:");
console.log("   • Variant ID alınır");
console.log("   • Line Item Properties eklenir:");
console.log("     - Boy: '100 cm'");
console.log("     - En: '150 cm'");
console.log("     - Materyal: 'Ahşap'");
console.log("     - Özel Ürün: 'Evet'");
console.log("     - Üretim Zamanı: bugünün tarihi");

console.log("\n3️⃣ SEPETTE GÖRMEK:");
console.log("   • Ürün adı: 'Özel Çerçeve 100×150cm - Ahşap'");
console.log("   • Fiyat: 4.50₺");
console.log("   • Özel özellikler görünür olmalı:");
console.log("     - Boy: 100 cm");
console.log("     - En: 150 cm");
console.log("     - Materyal: Ahşap");

console.log("\n4️⃣ BACKEND KONTROL:");
console.log("   • Admin > Products: yeni ürün (DRAFT)");
console.log("   • Metafields: silme zamanı kaydedilmiş");
console.log("   • Console log'lar: ürün oluşturma süreci");

console.log("\n🔍 DEBUG İPUÇLARI:");
console.log("   • Browser F12 > Console: JavaScript log'ları");
console.log("   • Network tab: API call'ları kontrol et");
console.log("   • Response data: product, cart, redirectUrl");

console.log("\n🎯 BAŞARI KRİTERLERİ:");
console.log("   ✅ Geçici ürün oluşuyor");
console.log("   ✅ Sepete yönlendiriliyor");
console.log("   ✅ Line item properties görünüyor");
console.log("   ✅ 2 saat sonra silinmek üzere işaretleniyor");

console.log("\n🚀 HAZIR! Test'e başlayabilirsin!");

/**
 * Manuel test için helper fonksiyon
 */
if (typeof window !== 'undefined') {
    window.testTaskResult = function (responseData) {
        console.log("\n📊 RESPONSE ANALİZİ:");
        console.log("===================");

        if (responseData.success) {
            console.log("✅ Başarılı!");

            if (responseData.product) {
                console.log(`📦 Ürün: ${responseData.product.title}`);
                console.log(`💰 ID: ${responseData.product.id}`);
            }

            if (responseData.cart) {
                console.log(`🛒 Variant ID: ${responseData.cart.variantId}`);
                console.log("📝 Properties:", responseData.cart.properties);
            }

            if (responseData.redirectUrl) {
                console.log(`🔗 Redirect URL: ${responseData.redirectUrl}`);
            }

            console.log("🎉 Task 9-10 BAŞARILI!");
        } else {
            console.log("❌ Hata:", responseData.error);
        }
    };
}