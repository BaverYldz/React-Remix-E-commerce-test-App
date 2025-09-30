// Günlük Temizlik Scheduler
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
    try {
        const { admin } = await authenticate.admin(request);
        const formData = await request.formData();
        const operation = formData.get('operation') || 'manual_cleanup';

        console.log(`🗓️ Scheduler operation: ${operation}`);

        let result;

        switch (operation) {
            case 'daily_cleanup':
                // Import dinamik olarak
                const { OperationMonitor } = await import('../operation-monitor');
                const monitor = new OperationMonitor(admin);
                result = await monitor.performDailyCleanup();
                break;
                
            case 'manual_cleanup':
                // Import dinamik olarak
                const { TemporaryProductCleanup } = await import('../cleanup-system');
                const cleanup = new TemporaryProductCleanup(admin);
                result = await cleanup.runCleanup();
                break;
                
            case 'health_check':
                const { OperationMonitor: HealthMonitor } = await import('../operation-monitor');
                const healthMonitor = new HealthMonitor(admin);
                result = await healthMonitor.checkSystemHealth();
                break;
                
            case 'generate_report':
                const { OperationMonitor: ReportMonitor } = await import('../operation-monitor');
                const reportMonitor = new ReportMonitor(admin);
                result = {
                    success: true,
                    report: reportMonitor.generateDailyReport()
                };
                break;
                
            case 'export_logs':
                const hours = parseInt(formData.get('hours')) || 24;
                const { OperationMonitor: LogMonitor } = await import('../operation-monitor');
                const logMonitor = new LogMonitor(admin);
                result = {
                    success: true,
                    export: logMonitor.exportLogs('all', hours)
                };
                break;
                
            default:
                // Fallback to simple cleanup
                result = await simpleCleanup(admin);
                break;
        }

        return json({
            success: true,
            operation: operation,
            timestamp: new Date().toISOString(),
            result: result
        });

    } catch (error) {
        console.error(`❌ Scheduler operation failed:`, error);
        return json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

// Basit cleanup fonksiyonu (fallback)
async function simpleCleanup(admin) {
    try {
        const response = await admin.graphql(`
            query getTemporaryProducts {
                products(first: 50, query: "tag:geçici-ürün") {
                    edges {
                        node {
                            id
                            title
                            createdAt
                        }
                    }
                }
            }
        `);

        const data = await response.json();
        const products = data.data?.products?.edges || [];
        
        let deleted = 0;
        const twoHoursAgo = new Date();
        twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

        for (const productEdge of products) {
            const product = productEdge.node;
            const createdAt = new Date(product.createdAt);

            if (createdAt < twoHoursAgo) {
                try {
                    await admin.graphql(`
                        mutation productDelete($input: ProductDeleteInput!) {
                            productDelete(input: $input) {
                                deletedProductId
                                userErrors {
                                    field
                                    message
                                }
                            }
                        }
                    `, {
                        variables: {
                            input: { id: product.id }
                        }
                    });
                    
                    deleted++;
                    console.log(`✅ Deleted expired product: ${product.title}`);
                } catch (deleteError) {
                    console.error(`❌ Failed to delete ${product.id}:`, deleteError);
                }
            }
        }

        return {
            success: true,
            deleted: deleted,
            total: products.length,
            message: `Simple cleanup completed: ${deleted} products deleted`
        };

    } catch (error) {
        console.error('❌ Simple cleanup failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

export default function DailyCleanupScheduler() {
    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h1>Günlük Temizlik Scheduler</h1>
            <p>Task 17: Otomatik günlük temizlik ve sistem izleme</p>

            <div style={{ 
                marginBottom: '20px', 
                padding: '15px', 
                backgroundColor: '#e8f4fd', 
                borderRadius: '5px',
                border: '1px solid #bde0ff'
            }}>
                <h3>Otomatik İşlemler</h3>
                <ul>
                    <li><strong>Günlük Tarama:</strong> 24 saat+ eski geçici ürünleri bulup siler</li>
                    <li><strong>Manuel Temizlik:</strong> 2 saat+ eski ürünleri hemen siler</li>
                    <li><strong>Sağlık Kontrolü:</strong> Sistem durumunu kontrol eder</li>
                    <li><strong>Log Arşivleme:</strong> İşlem kayıtlarını düzenler</li>
                </ul>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                <SchedulerButton
                    operation="manual_cleanup"
                    label="Manuel Temizlik"
                    description="2 saat+ eski ürünleri sil"
                />
                
                <SchedulerButton
                    operation="daily_cleanup"
                    label="Günlük Temizlik"
                    description="24 saat+ eski ürünleri sil"
                />
                
                <SchedulerButton
                    operation="health_check"
                    label="Sağlık Kontrolü"
                    description="Sistem durumunu kontrol et"
                />
                
                <SchedulerButton
                    operation="generate_report"
                    label="Günlük Rapor"
                    description="24 saatlik aktivite raporu"
                />
                
                <SchedulerButton
                    operation="export_logs"
                    label="Log Export"
                    description="İşlem kayıtlarını export et"
                />
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h3>Scheduler Ayarları</h3>
                <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                    <label style={{ display: 'block', marginBottom: '10px' }}>
                        <strong>Log Export Süresi (saat):</strong>
                        <input 
                            type="number" 
                            id="logHours" 
                            defaultValue="24" 
                            min="1" 
                            max="168"
                            style={{ marginLeft: '10px', padding: '5px', width: '80px' }}
                        />
                    </label>
                </div>
            </div>

            <div id="schedulerResults" style={{ 
                marginTop: '20px', 
                padding: '15px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '5px',
                display: 'none'
            }}>
                <h3>İşlem Sonuçları:</h3>
                <div id="schedulerContent"></div>
            </div>

            <div style={{ 
                marginTop: '30px', 
                padding: '15px', 
                backgroundColor: '#fff3cd', 
                borderRadius: '5px',
                border: '1px solid #ffeaa7'
            }}>
                <h4>Önemli Notlar:</h4>
                <ul style={{ marginBottom: 0 }}>
                    <li>Manuel temizlik 2 saat+ eski ürünleri siler</li>
                    <li>Günlük temizlik 24 saat+ eski ürünleri siler</li>
                    <li>Siparişe girmiş ürünler de silinir (sipariş kaydı korunur)</li>
                    <li>Sistem logları otomatik tutulur</li>
                </ul>
            </div>
        </div>
    );
}

function SchedulerButton({ operation, label, description }) {
    const handleOperation = async () => {
        const resultsDiv = document.getElementById('schedulerResults');
        const contentDiv = document.getElementById('schedulerContent');
        
        resultsDiv.style.display = 'block';
        contentDiv.innerHTML = '<p>İşlem çalışıyor...</p>';
        
        try {
            const formData = new FormData();
            formData.append('operation', operation);
            
            if (operation === 'export_logs') {
                const hours = document.getElementById('logHours').value;
                formData.append('hours', hours);
            }
            
            const response = await fetch('/apps/cleanup-scheduler-new', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                let content = `
                    <div style="color: green; marginBottom: 10px;">
                        <strong>${label} başarılı!</strong>
                    </div>
                    <div style="marginBottom: 10px;">
                        <strong>İşlem:</strong> ${result.operation}<br>
                        <strong>Zaman:</strong> ${new Date(result.timestamp).toLocaleString('tr-TR')}
                    </div>
                `;

                // Operation-specific content
                if (result.result.deleted !== undefined) {
                    content += `
                        <div style="padding: 10px; backgroundColor: '#e8f5e8'; borderRadius: 3px; marginBottom: 10px;">
                            <strong>Temizlik Sonuçları:</strong><br>
                            Silinen ürün: ${result.result.deleted}<br>
                            Toplam bulunan: ${result.result.total || 'N/A'}<br>
                            ${result.result.errors ? `Hata sayısı: ${result.result.errors}<br>` : ''}
                        </div>
                    `;
                }

                content += `
                    <details>
                        <summary style="cursor: pointer;">Detaylar</summary>
                        <pre style="background: #f8f8f8; padding: 10px; borderRadius: 3px; overflow: auto; fontSize: 12px; maxHeight: 300px;">
${JSON.stringify(result.result, null, 2)}
                        </pre>
                    </details>
                `;

                contentDiv.innerHTML = content;
            } else {
                contentDiv.innerHTML = `
                    <div style="color: red; marginBottom: 10px;">
                        <strong>İşlem başarısız:</strong>
                    </div>
                    <div style="backgroundColor: '#ffe6e6'; padding: 10px; borderRadius: 3px;">
                        ${result.error}
                    </div>
                `;
            }
            
        } catch (error) {
            contentDiv.innerHTML = `
                <div style="color: red; marginBottom: 10px;">
                    <strong>Bağlantı hatası:</strong>
                </div>
                <div style="backgroundColor: '#ffe6e6'; padding: 10px; borderRadius: 3px;">
                    ${error.message}
                </div>
            `;
        }
    };

    return (
        <button
            onClick={handleOperation}
            style={{
                padding: '12px 16px',
                backgroundColor: '#2c3e50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                textAlign: 'left',
                transition: 'background-color 0.2s ease',
                width: '100%'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#34495e'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#2c3e50'}
        >
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                {label}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>
                {description}
            </div>
        </button>
    );
}