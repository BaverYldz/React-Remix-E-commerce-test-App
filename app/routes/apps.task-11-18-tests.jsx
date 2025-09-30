// Sistem test arayüzü
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

import { AdvancedCleanupTest } from '../task-11-13-test';
import { testProductVisibility } from '../product-visibility-manager';
import { testErrorHandling } from '../error-handler';
import { testOperationMonitoring } from '../operation-monitor';
import { TemporaryProductCleanup } from '../cleanup-system';

export async function action({ request }) {
    try {
        const { admin } = await authenticate.admin(request);
        const formData = await request.formData();
        const testType = formData.get('testType') || 'all';

        const results = {};

        // Temel cleanup sistemi
        if (testType === 'all' || testType === 'cleanup') {
            console.log('\n=== Task 11-13: Cleanup System ===');
            const cleanupTest = new AdvancedCleanupTest(admin);
            results.task1113 = await cleanupTest.runAllTests();
        }

        // Ürün görünürlüğü
        if (testType === 'all' || testType === 'visibility') {
            console.log('\n=== Task 14: Product Visibility ===');
            results.task14 = await testProductVisibility(admin);
        }

        // Hata yönetimi
        if (testType === 'all' || testType === 'errors') {
            console.log('\n=== Task 15-16: Error Handling ===');
            results.task1516 = await testErrorHandling();
        }

        // İzleme sistemi
        if (testType === 'all' || testType === 'monitoring') {
            console.log('\n=== Task 17-18: Monitoring ===');
            results.task1718 = await testOperationMonitoring(admin);
        }

        // Cleanup sistemi health check
        if (testType === 'all' || testType === 'health') {
            console.log('\n=== System Health Check ===');
            const cleanup = new TemporaryProductCleanup(admin);

            // Son 24 saatteki logları export et
            const logs = cleanup.exportLogs(24);

            results.healthCheck = {
                timestamp: new Date().toISOString(),
                logExport: logs,
                systemStatus: 'operational'
            };
        }

        console.log('\n🎉 All tests completed!');

        return json({
            success: true,
            testType: testType,
            completedAt: new Date().toISOString(),
            results: results,
            summary: generateTestSummary(results)
        });

    } catch (error) {
        console.error('❌ Test suite failed:', error);
        return json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}

function generateTestSummary(results) {
    const summary = {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        details: {}
    };

    Object.entries(results).forEach(([taskName, result]) => {
        if (taskName === 'healthCheck') {
            summary.details[taskName] = {
                status: 'info',
                message: 'Health check completed'
            };
            return;
        }

        summary.totalTests++;

        if (result.success) {
            summary.passedTests++;
            summary.details[taskName] = {
                status: 'passed',
                message: result.message || 'Test passed'
            };
        } else {
            summary.failedTests++;
            summary.details[taskName] = {
                status: 'failed',
                message: result.error || 'Test failed'
            };
        }
    });

    summary.successRate = summary.totalTests > 0
        ? (summary.passedTests / summary.totalTests * 100).toFixed(1) + '%'
        : '0%';

    return summary;
}

export default function Task11To18TestPage() {
    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h1>Task 11-18 Test Suite</h1>
            <p>Geçici ürün yönetimi sisteminin tüm özelliklerini test eder.</p>

            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
                <h3>Test Kapsamı:</h3>
                <ul>
                    <li><strong>Task 11-13:</strong> Otomatik temizlik sistemi</li>
                    <li><strong>Task 14:</strong> Ürün görünürlük yönetimi</li>
                    <li><strong>Task 15-16:</strong> Hata yönetimi ve dayanıklılık</li>
                    <li><strong>Task 17-18:</strong> Operasyon izleme ve loglama</li>
                </ul>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <TestButton
                    label="Tüm Testler"
                    testType="all"
                    description="Tüm sistemleri test et"
                />
                <TestButton
                    label="Cleanup Tests"
                    testType="cleanup"
                    description="Task 11-13 testleri"
                />
                <TestButton
                    label="Visibility Tests"
                    testType="visibility"
                    description="Task 14 testleri"
                />
                <TestButton
                    label="Error Tests"
                    testType="errors"
                    description="Task 15-16 testleri"
                />
                <TestButton
                    label="Monitoring Tests"
                    testType="monitoring"
                    description="Task 17-18 testleri"
                />
                <TestButton
                    label="Health Check"
                    testType="health"
                    description="Sistem sağlık kontrolü"
                />
            </div>

            <div id="testResults" style={{
                marginTop: '20px',
                padding: '15px',
                backgroundColor: '#f0f0f0',
                borderRadius: '5px',
                display: 'none'
            }}>
                <h3>Test Sonuçları:</h3>
                <div id="resultContent"></div>
            </div>
        </div>
    );
}

function TestButton({ label, testType, description }) {
    const handleTest = async () => {
        const resultsDiv = document.getElementById('testResults');
        const contentDiv = document.getElementById('resultContent');

        // Loading state
        resultsDiv.style.display = 'block';
        contentDiv.innerHTML = '<p>Test çalışıyor, lütfen bekleyin...</p>';

        try {
            const formData = new FormData();
            formData.append('testType', testType);

            const response = await fetch('/apps/task-11-18-tests', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                contentDiv.innerHTML = `
                    <div style="color: green; marginBottom: 10px;">
                        <strong>Test başarılı!</strong>
                    </div>
                    <div style="marginBottom: 10px;">
                        <strong>Test Tipi:</strong> ${result.testType}<br>
                        <strong>Tamamlanma:</strong> ${new Date(result.completedAt).toLocaleString('tr-TR')}
                    </div>
                    ${result.summary ? `
                        <div style="padding: 10px; backgroundColor: '#e8f5e8'; borderRadius: 3px; marginBottom: 10px;">
                            <strong>Özet:</strong><br>
                            Toplam: ${result.summary.totalTests} test<br>
                            Başarılı: ${result.summary.passedTests}<br>
                            Başarısız: ${result.summary.failedTests}<br>
                            Başarı Oranı: ${result.summary.successRate}
                        </div>
                    ` : ''}
                    <details>
                        <summary style="cursor: pointer; marginBottom: 10px;">Detaylı Sonuçlar</summary>
                        <pre style="background: #f8f8f8; padding: 10px; borderRadius: 3px; overflow: auto; fontSize: 12px;">
${JSON.stringify(result.results, null, 2)}
                        </pre>
                    </details>
                `;
            } else {
                contentDiv.innerHTML = `
                    <div style="color: red; marginBottom: 10px;">
                        <strong>Test başarısız:</strong>
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
            onClick={handleTest}
            style={{
                padding: '12px 16px',
                backgroundColor: '#2c3e50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                minWidth: '150px',
                transition: 'background-color 0.2s ease'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#34495e'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#2c3e50'}
            title={description}
        >
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>{description}</div>
        </button>
    );
}