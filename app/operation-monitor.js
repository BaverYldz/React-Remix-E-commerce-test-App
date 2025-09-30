// İzleme ve logging

export class OperationMonitor {
    constructor(admin) {
        this.admin = admin;
        this.logs = [];
        this.alerts = [];
        this.thresholds = {
            maxErrorsPerHour: 10,
            maxFailedCleanupsPerDay: 5,
            maxTempProductsAlert: 50
        };
    }

    // Günlük temizlik taraması
    async performDailyCleanup() {
        console.log('🗓️ Starting daily cleanup scan...');
        
        const startTime = new Date();
        const logEntry = {
            id: `daily_cleanup_${Date.now()}`,
            type: 'DAILY_CLEANUP',
            startTime: startTime.toISOString(),
            status: 'RUNNING'
        };
        
        this.addLog(logEntry);
        
        try {
            // 1. Tüm geçici ürünleri bul
            const allTempProducts = await this.findAllTemporaryProducts();
            
            // 2. 24 saat+ olanları belirle
            const oldProducts = this.filterOldProducts(allTempProducts, 24);
            
            // 3. Cleanup sistemi ile temizle
            const { TemporaryProductCleanup } = await import('./cleanup-system.js');
            const cleanup = new TemporaryProductCleanup(this.admin);
            
            const cleanupResult = await cleanup.deleteExpiredProducts();
            
            // 4. Sonuçları logla
            const endTime = new Date();
            const duration = endTime - startTime;
            
            logEntry.status = 'COMPLETED';
            logEntry.endTime = endTime.toISOString();
            logEntry.duration = duration;
            logEntry.results = {
                totalFound: allTempProducts.length,
                oldProducts: oldProducts.length,
                deleted: cleanupResult.deleted,
                errors: cleanupResult.errors,
                efficiency: cleanupResult.deleted / Math.max(oldProducts.length, 1) * 100
            };
            
            this.updateLog(logEntry);
            
            // 5. Alert kontrolü
            if (cleanupResult.errors > 0) {
                this.createAlert('CLEANUP_ERRORS', `Daily cleanup had ${cleanupResult.errors} errors`, 'warning');
            }
            
            if (allTempProducts.length > this.thresholds.maxTempProductsAlert) {
                this.createAlert('HIGH_TEMP_PRODUCTS', `${allTempProducts.length} temporary products found (threshold: ${this.thresholds.maxTempProductsAlert})`, 'warning');
            }
            
            console.log(`✅ Daily cleanup completed: ${cleanupResult.deleted} deleted, ${cleanupResult.errors} errors`);
            
            return {
                success: true,
                ...logEntry
            };
            
        } catch (error) {
            console.error('❌ Daily cleanup failed:', error);
            
            logEntry.status = 'FAILED';
            logEntry.error = error.message;
            logEntry.endTime = new Date().toISOString();
            
            this.updateLog(logEntry);
            this.createAlert('DAILY_CLEANUP_FAILED', `Daily cleanup failed: ${error.message}`, 'critical');
            
            return {
                success: false,
                error: error.message,
                ...logEntry
            };
        }
    }

    // Log sistemi
    addLog(entry) {
        const logEntry = {
            ...entry,
            timestamp: entry.timestamp || new Date().toISOString(),
            id: entry.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
        this.logs.push(logEntry);
        
        // Log boyutunu sınırla (son 1000 entry)
        if (this.logs.length > 1000) {
            this.logs.shift();
        }
        
        console.log(`📝 LOG [${logEntry.type}]:`, logEntry);
        
        return logEntry.id;
    }

    updateLog(updatedEntry) {
        const index = this.logs.findIndex(log => log.id === updatedEntry.id);
        if (index !== -1) {
            this.logs[index] = { ...this.logs[index], ...updatedEntry };
            console.log(`📝 LOG UPDATED [${updatedEntry.type}]:`, this.logs[index]);
        }
    }

    // Alert sistemi
    createAlert(type, message, severity = 'info') {
        const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: type,
            message: message,
            severity: severity, // info, warning, critical
            timestamp: new Date().toISOString(),
            status: 'active',
            acknowledged: false
        };
        
        this.alerts.push(alert);
        
        // Alert boyutunu sınırla (son 100 alert)
        if (this.alerts.length > 100) {
            this.alerts.shift();
        }
        
        console.log(`🚨 ALERT [${severity.toUpperCase()}] ${type}:`, message);
        
        // Critical alertler için ek loglama
        if (severity === 'critical') {
            this.addLog({
                type: 'CRITICAL_ALERT',
                alertId: alert.id,
                alertType: type,
                message: message
            });
        }
        
        return alert.id;
    }

    // Alert'i acknowledge et
    acknowledgeAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            alert.acknowledgedAt = new Date().toISOString();
            console.log(`✅ Alert acknowledged: ${alertId}`);
            return true;
        }
        return false;
    }

    // Performans izleme
    async checkSystemHealth() {
        console.log('🔍 Checking system health...');
        
        const healthCheck = {
            timestamp: new Date().toISOString(),
            checks: {}
        };
        
        try {
            // 1. Geçici ürün sayısı
            const tempProducts = await this.findAllTemporaryProducts();
            healthCheck.checks.temporaryProducts = {
                status: tempProducts.length < this.thresholds.maxTempProductsAlert ? 'healthy' : 'warning',
                count: tempProducts.length,
                threshold: this.thresholds.maxTempProductsAlert
            };
            
            // 2. Son 24 saatteki hata sayısı
            const recentErrors = this.getRecentErrors(24);
            healthCheck.checks.errorRate = {
                status: recentErrors.length < this.thresholds.maxErrorsPerHour * 24 ? 'healthy' : 'warning',
                count: recentErrors.length,
                threshold: this.thresholds.maxErrorsPerHour * 24
            };
            
            // 3. Son cleanup durumu
            const lastCleanup = this.logs
                .filter(log => log.type === 'DAILY_CLEANUP')
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
                
            healthCheck.checks.lastCleanup = {
                status: lastCleanup && lastCleanup.status === 'COMPLETED' ? 'healthy' : 'warning',
                lastRun: lastCleanup?.timestamp || 'never',
                success: lastCleanup?.status === 'COMPLETED'
            };
            
            // 4. Aktif alertler
            const activeAlerts = this.alerts.filter(a => a.status === 'active' && !a.acknowledged);
            healthCheck.checks.activeAlerts = {
                status: activeAlerts.length === 0 ? 'healthy' : 'warning',
                count: activeAlerts.length
            };
            
            // Genel durum
            const allChecksHealthy = Object.values(healthCheck.checks)
                .every(check => check.status === 'healthy');
                
            healthCheck.overallStatus = allChecksHealthy ? 'healthy' : 'degraded';
            
            this.addLog({
                type: 'HEALTH_CHECK',
                status: healthCheck.overallStatus,
                details: healthCheck
            });
            
            return healthCheck;
            
        } catch (error) {
            console.error('❌ Health check failed:', error);
            healthCheck.overallStatus = 'error';
            healthCheck.error = error.message;
            
            return healthCheck;
        }
    }

    // Yardımcı fonksiyonlar
    async findAllTemporaryProducts() {
        try {
            const query = `
                query getTempProducts($tag: String!, $first: Int!) {
                    products(first: $first, query: $tag) {
                        edges {
                            node {
                                id
                                title
                                createdAt
                                tags
                            }
                        }
                    }
                }
            `;
            
            const response = await this.admin.graphql(query, {
                variables: {
                    tag: 'tag:geçici-ürün',
                    first: 250
                }
            });
            
            const result = await response.json();
            return result.data?.products?.edges?.map(edge => edge.node) || [];
            
        } catch (error) {
            console.error('❌ Failed to find temporary products:', error);
            return [];
        }
    }

    filterOldProducts(products, hoursOld) {
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - hoursOld);
        
        return products.filter(product => 
            new Date(product.createdAt) < cutoff
        );
    }

    getRecentErrors(hours) {
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - hours);
        
        return this.logs.filter(log => 
            log.type.includes('ERROR') && 
            new Date(log.timestamp) > cutoff
        );
    }

    // Rapor oluşturma
    generateDailyReport() {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const dailyLogs = this.logs.filter(log => 
            new Date(log.timestamp) >= yesterday && 
            new Date(log.timestamp) < today
        );
        
        const report = {
            date: today.toISOString().split('T')[0],
            summary: {
                totalOperations: dailyLogs.length,
                errors: dailyLogs.filter(log => log.status === 'FAILED' || log.type.includes('ERROR')).length,
                cleanups: dailyLogs.filter(log => log.type === 'DAILY_CLEANUP').length,
                alerts: this.alerts.filter(alert => 
                    new Date(alert.timestamp) >= yesterday && 
                    new Date(alert.timestamp) < today
                ).length
            },
            details: {
                operations: dailyLogs,
                alerts: this.alerts.filter(alert => 
                    new Date(alert.timestamp) >= yesterday && 
                    new Date(alert.timestamp) < today
                )
            }
        };
        
        console.log('📊 Daily Report Generated:', report.summary);
        
        return report;
    }

    // Log export (debug için)
    exportLogs(type = null, hours = 24) {
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - hours);
        
        let filteredLogs = this.logs.filter(log => 
            new Date(log.timestamp) > cutoff
        );
        
        if (type) {
            filteredLogs = filteredLogs.filter(log => log.type === type);
        }
        
        return {
            exportedAt: new Date().toISOString(),
            timeFrame: `${hours} hours`,
            type: type || 'all',
            count: filteredLogs.length,
            logs: filteredLogs
        };
    }
}

// Test fonksiyonları
export async function testOperationMonitoring(admin) {
    console.log('🧪 Testing Task 17-18: Operation monitoring...');
    
    const monitor = new OperationMonitor(admin);
    
    try {
        // Test logs
        monitor.addLog({
            type: 'TEST_OPERATION',
            message: 'Testing log system',
            status: 'SUCCESS'
        });
        
        // Test alerts
        monitor.createAlert('TEST_ALERT', 'Testing alert system', 'info');
        
        // Test health check
        const healthCheck = await monitor.checkSystemHealth();
        console.log('🔍 Health check:', healthCheck);
        
        // Test daily report
        const report = monitor.generateDailyReport();
        console.log('📊 Daily report generated');
        
        return {
            success: true,
            message: 'Task 17-18 monitoring tests completed',
            results: {
                healthCheck,
                reportSummary: report.summary,
                logCount: monitor.logs.length,
                alertCount: monitor.alerts.length
            }
        };
        
    } catch (error) {
        console.error('❌ Task 17-18 test failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}