// Manual Cleanup
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { triggerManualCleanup } from "../cleanup-scheduler.js";
import { testCleanupSystem } from "../cleanup-test-helper.js";

export async function action({ request }) {
    try {
        const { admin } = await authenticate.admin(request);
        const formData = await request.formData();
        const action = formData.get('action');

        if (action === 'test') {
            // Test expired product oluştur ve cleanup yap
            console.log('� Running cleanup system test...');
            const result = await testCleanupSystem(admin);

            return json({
                success: true,
                message: `Test completed: ${result.success ? 'PASSED' : 'FAILED'}`,
                details: result
            });
        } else {
            // Normal cleanup
            console.log('🧹 Manual cleanup requested');
            const result = await triggerManualCleanup(admin);

            return json({
                success: true,
                message: `Cleanup completed: ${result.deleted} deleted, ${result.errors} errors`,
                details: result
            });
        }

    } catch (error) {
        console.error('❌ Manual cleanup failed:', error);
        return json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

// Test sayfası
export default function CleanupPage() {
    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h1>🧹 Cleanup System Test</h1>

            <div style={{ marginBottom: '20px' }}>
                <h2>Task 11-13: Geçici Ürün Temizlik Sistemi</h2>
                <p>Bu sistem:</p>
                <ul>
                    <li>✅ <strong>Task 11:</strong> Geçici ürünlere silme zamanı kaydeder (metafield)</li>
                    <li>✅ <strong>Task 12:</strong> Her 5 dakikada otomatik temizlik yapar</li>
                    <li>✅ <strong>Task 13:</strong> Siparişe girmiş ürünleri de temizler</li>
                </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <button
                    onClick={() => {
                        const formData = new FormData();
                        formData.append('action', 'normal');
                        fetch('/apps/cleanup-manual', { method: 'POST', body: formData })
                            .then(r => r.json())
                            .then(data => {
                                alert('Normal Cleanup:\n' + JSON.stringify(data, null, 2));
                            })
                            .catch(err => alert('Error: ' + err.message));
                    }}
                    style={{
                        padding: '10px 20px',
                        fontSize: '16px',
                        backgroundColor: '#d32f2f',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        marginRight: '10px'
                    }}
                >
                    🗑️ Normal Cleanup (Gerçek Expired)
                </button>

                <button
                    onClick={() => {
                        const formData = new FormData();
                        formData.append('action', 'test');
                        fetch('/apps/cleanup-manual', { method: 'POST', body: formData })
                            .then(r => r.json())
                            .then(data => {
                                alert('Test Cleanup:\n' + JSON.stringify(data, null, 2));
                            })
                            .catch(err => alert('Error: ' + err.message));
                    }}
                    style={{
                        padding: '10px 20px',
                        fontSize: '16px',
                        backgroundColor: '#2196f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                    }}
                >
                    Test Cleanup (Fake Expired)
                </button>
            </div>

            <div style={{ backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '5px' }}>
                <h3>Test Adımları:</h3>
                <ol>
                    <li>Product sayfasına git ve konfiguratör ile ürün oluştur</li>
                    <li>Ürün sepete eklendiğini kontrol et</li>
                    <li>Admin → Products'ta "geçici-ürün" tag'li ürünleri gör</li>
                    <li>Bu butona tıklayarak manuel temizlik yap</li>
                    <li>2 saat+ eski ürünlerin silindiğini kontrol et</li>
                </ol>
            </div>

            <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
                <p><strong>Not:</strong> Gerçek üretimde cleanup her 5 dakikada otomatik çalışır.</p>
                <p><strong>Güvenlik:</strong> Siparişe girmiş ürünler de 2 saat sonra silinir (Task 13).</p>
            </div>
        </div>
    );
}