// Task 11-13 Test Scenarios
console.log('🧪 Testing Task 11-13: Cleanup System');

// Test senaryoları:
const testScenarios = [
    {
        name: "Task 11: Silme zamanını kaydet",
        description: "Geçici ürün oluşturulduğunda metafield ile silme zamanı kaydedilir",
        steps: [
            "1. Product configurator ile ürün oluştur",
            "2. Admin panelde Products > All products'ta 'geçici-ürün' tag'i ara",
            "3. Ürünün metafield'inde cleanup_at zamanını kontrol et",
            "4. Zaman = oluşturma zamanı + 2 saat olmalı"
        ],
        expected: "Metafield: custom.cleanup_at = ISO string (oluşturma + 2 saat)"
    },

    {
        name: "Task 12: Otomatik temizlik",
        description: "Her 5 dakikada expired ürünler otomatik silinir",
        steps: [
            "1. Birkaç geçici ürün oluştur",
            "2. Manuel cleanup butonu ile test et: /apps/cleanup-manual",
            "3. 2 saat+ eski ürünlerin silindiğini kontrol et",
            "4. Yeni ürünlerin silinmediğini kontrol et"
        ],
        expected: "Console: 'Cleanup completed: X deleted, Y errors'"
    },

    {
        name: "Task 13: Siparişli ürün güvenliği",
        description: "Siparişe girmiş ürünler de 2 saat sonra silinir",
        steps: [
            "1. Geçici ürün oluştur ve sepete ekle",
            "2. Checkout'a git (sipariş verme simülasyonu)",
            "3. 2 saat sonra manuel cleanup çalıştır",
            "4. Ürünün silindiğini, ama sipariş history'nin bozulmadığını kontrol et"
        ],
        expected: "Ürün silinir, sipariş kaydı korunur"
    }
];

console.log('\n📋 Test Checklist:');
testScenarios.forEach((scenario, index) => {
    console.log(`\n${index + 1}. ${scenario.name}`);
    console.log(`   Description: ${scenario.description}`);
    console.log(`   Expected: ${scenario.expected}`);
    console.log(`   Steps:`);
    scenario.steps.forEach(step => console.log(`     ${step}`));
});

console.log('\n🔧 Manual Test Commands:');
console.log('- Create product: Use configurator on product page');
console.log('- Manual cleanup: POST to /apps/cleanup-manual');
console.log('- Check products: Admin > Products > filter by "geçici-ürün"');
console.log('- Check metafields: GraphQL API or product admin page');

console.log('\n✅ Success Criteria:');
console.log('- Task 11: Metafield cleanup_at correctly set on product creation');
console.log('- Task 12: Expired products (2h+) automatically deleted every 5 min');
console.log('- Task 13: Order history preserved even after product deletion');

// Test helper - metafield kontrol
const metafieldTestQuery = `
query getProductMetafields($id: ID!) {
  product(id: $id) {
    id
    title
    tags
    createdAt
    metafield(namespace: "custom", key: "cleanup_at") {
      value
      type
    }
  }
}
`;

console.log('\n📊 GraphQL Test Query (Product metafield):');
console.log(metafieldTestQuery);

console.log('\n🚀 Ready to test Task 11-13!');