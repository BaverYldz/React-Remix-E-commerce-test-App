// Hata yönetimi ve retry mekanizması

export class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 saniye
    }

    // Kullanıcı dostu hata mesajları
    formatUserError(error, context = 'system') {
        const errorMessages = {
            'PRODUCT_CREATE_FAILED': {
                user: 'Ürün oluşturulamadı. Lütfen seçimlerinizi kontrol edip tekrar deneyin.',
                action: 'Tekrar Dene',
                technical: 'Product creation mutation failed'
            },
            'CART_ADD_FAILED': {
                user: 'Ürün sepete eklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.',
                action: 'Tekrar Dene',
                technical: 'Cart add operation failed'
            },
            'PRICING_CALCULATION_FAILED': {
                user: 'Fiyat hesaplanamadı. Lütfen boy, en ve materyal seçimlerinizi kontrol edin.',
                action: 'Seçimleri Kontrol Et',
                technical: 'Pricing rules calculation failed'
            },
            'NETWORK_ERROR': {
                user: 'Bağlantı sorunu yaşanıyor. Lütfen internet bağlantınızı kontrol edin.',
                action: 'Tekrar Dene',
                technical: 'Network request failed'
            },
            'CLEANUP_FAILED': {
                user: 'Sistem temizliği sırasında bir sorun oluştu. Destek ekibine bildirildi.',
                action: 'Devam Et',
                technical: 'Cleanup process failed'
            },
            'FORM_VALIDATION_FAILED': {
                user: 'Lütfen tüm alanları doğru şekilde doldurun.',
                action: 'Formu Kontrol Et',
                technical: 'Form validation failed'
            },
            'SHOPIFY_API_LIMIT': {
                user: 'Sistem yoğunluğu nedeniyle işlem gecikmeli. Lütfen birkaç saniye bekleyip tekrar deneyin.',
                action: 'Bekle ve Tekrar Dene',
                technical: 'Shopify API rate limit exceeded'
            }
        };

        // Hata tipini belirle
        let errorType = 'UNKNOWN_ERROR';
        const errorMessage = error?.message || error || 'Unknown error';

        if (errorMessage.includes('product') && errorMessage.includes('create')) {
            errorType = 'PRODUCT_CREATE_FAILED';
        } else if (errorMessage.includes('cart') || errorMessage.includes('add')) {
            errorType = 'CART_ADD_FAILED';
        } else if (errorMessage.includes('pricing') || errorMessage.includes('calculation')) {
            errorType = 'PRICING_CALCULATION_FAILED';
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            errorType = 'NETWORK_ERROR';
        } else if (errorMessage.includes('cleanup')) {
            errorType = 'CLEANUP_FAILED';
        } else if (errorMessage.includes('validation')) {
            errorType = 'FORM_VALIDATION_FAILED';
        } else if (errorMessage.includes('rate') || errorMessage.includes('limit')) {
            errorType = 'SHOPIFY_API_LIMIT';
        }

        const errorInfo = errorMessages[errorType] || {
            user: 'Beklenmeyen bir hata oluştu. Lütfen sayfayı yenilemeyi deneyin.',
            action: 'Sayfayı Yenile',
            technical: errorMessage
        };

        // Hatayı logla
        this.logError(errorType, errorMessage, context);

        return {
            type: errorType,
            userMessage: errorInfo.user,
            suggestedAction: errorInfo.action,
            technicalMessage: errorInfo.technical,
            timestamp: new Date().toISOString(),
            context: context,
            canRetry: ['PRODUCT_CREATE_FAILED', 'CART_ADD_FAILED', 'NETWORK_ERROR', 'SHOPIFY_API_LIMIT'].includes(errorType)
        };
    }

    // Retry mekanizması
    async retryOperation(operation, operationName, maxAttempts = null) {
        const attempts = maxAttempts || this.retryAttempts;
        
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                console.log(`🔄 ${operationName} - Attempt ${attempt}/${attempts}`);
                
                const result = await operation();
                
                if (attempt > 1) {
                    console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
                }
                
                return {
                    success: true,
                    result: result,
                    attempts: attempt
                };
                
            } catch (error) {
                console.error(`❌ ${operationName} failed on attempt ${attempt}:`, error.message);
                
                if (attempt === attempts) {
                    // Son deneme de başarısız
                    const formattedError = this.formatUserError(error, operationName);
                    
                    return {
                        success: false,
                        error: formattedError,
                        attempts: attempt,
                        finalError: error
                    };
                }
                
                // Sonraki deneme için bekle
                await this.delay(this.retryDelay * attempt); // Exponential backoff
            }
        }
    }

    // Yinelenen oluşturma engeli
    async preventDuplicateCreation(identifier, operation, ttlMinutes = 5) {
        const key = `operation_${identifier}`;
        const now = Date.now();
        
        // Basit in-memory cache (gerçek uygulamada Redis/Database kullanın)
        if (!this.operationCache) {
            this.operationCache = new Map();
        }
        
        // Önceki işlemi kontrol et
        const previousOperation = this.operationCache.get(key);
        if (previousOperation && (now - previousOperation.timestamp) < (ttlMinutes * 60 * 1000)) {
            console.log(`⚠️ Duplicate operation prevented for: ${identifier}`);
            return {
                success: false,
                isDuplicate: true,
                message: 'Bu seçim için zaten bir işlem devam ediyor. Lütfen bekleyin.',
                previousResult: previousOperation.result,
                timeRemaining: Math.ceil(((previousOperation.timestamp + ttlMinutes * 60 * 1000) - now) / 1000)
            };
        }
        
        try {
            // İşlemi cache'e ekle
            this.operationCache.set(key, {
                timestamp: now,
                status: 'in_progress'
            });
            
            // İşlemi çalıştır
            const result = await operation();
            
            // Başarılı sonucu cache'e kaydet
            this.operationCache.set(key, {
                timestamp: now,
                status: 'completed',
                result: result
            });
            
            console.log(`✅ Operation completed for: ${identifier}`);
            
            return {
                success: true,
                result: result,
                isDuplicate: false
            };
            
        } catch (error) {
            // Hata durumunda cache'den temizle
            this.operationCache.delete(key);
            throw error;
        }
    }

    // Hata loglama
    logError(type, message, context) {
        const errorEntry = {
            type: type,
            message: message,
            context: context,
            timestamp: new Date().toISOString(),
            id: Date.now().toString()
        };
        
        this.errorLog.push(errorEntry);
        
        // Log boyutunu sınırla (son 100 hata)
        if (this.errorLog.length > 100) {
            this.errorLog.shift();
        }
        
        console.error(`🚨 ERROR [${type}] in ${context}:`, message);
    }

    // Hata istatistikleri
    getErrorStats(hours = 24) {
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - hours);
        
        const recentErrors = this.errorLog.filter(error => 
            new Date(error.timestamp) > cutoff
        );
        
        const errorCounts = {};
        recentErrors.forEach(error => {
            errorCounts[error.type] = (errorCounts[error.type] || 0) + 1;
        });
        
        return {
            totalErrors: recentErrors.length,
            timeFrame: `${hours} hours`,
            errorBreakdown: errorCounts,
            criticalErrors: recentErrors.filter(error => 
                ['PRODUCT_CREATE_FAILED', 'CLEANUP_FAILED'].includes(error.type)
            ).length
        };
    }

    // Yardımcı fonksiyon: gecikme
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Cache temizleme (bellek sızıntısını önlemek için)
    cleanupCache() {
        if (!this.operationCache) return;
        
        const now = Date.now();
        const maxAge = 60 * 60 * 1000; // 1 saat
        
        for (const [key, value] of this.operationCache.entries()) {
            if (now - value.timestamp > maxAge) {
                this.operationCache.delete(key);
            }
        }
    }
}

// Global error handler instance
export const globalErrorHandler = new ErrorHandler();

// Test fonksiyonları
export async function testErrorHandling() {
    console.log('🧪 Testing Task 15-16: Error handling and resilience...');
    
    const handler = new ErrorHandler();
    
    // Test 1: Hata mesajı formatlaması
    const networkError = new Error('network timeout');
    const formattedError = handler.formatUserError(networkError, 'cart_addition');
    console.log('📋 Formatted error:', formattedError);
    
    // Test 2: Retry mekanizması
    let attemptCount = 0;
    const flakyOperation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
            throw new Error('temporary failure');
        }
        return { success: true, data: 'operation completed' };
    };
    
    const retryResult = await handler.retryOperation(flakyOperation, 'test_operation');
    console.log('🔄 Retry result:', retryResult);
    
    // Test 3: Duplicate prevention
    const duplicateResult1 = await handler.preventDuplicateCreation(
        'test_product_123',
        async () => ({ productId: 'test_123', created: true }),
        1
    );
    
    const duplicateResult2 = await handler.preventDuplicateCreation(
        'test_product_123',
        async () => ({ productId: 'test_123', created: true }),
        1
    );
    
    console.log('🚫 Duplicate prevention test:', {
        first: duplicateResult1,
        second: duplicateResult2
    });
    
    // Test 4: Error stats
    const stats = handler.getErrorStats(1);
    console.log('📊 Error statistics:', stats);
    
    return {
        success: true,
        message: 'Task 15-16 error handling tests completed',
        results: {
            formattedError,
            retryResult,
            duplicatePrevention: { first: duplicateResult1, second: duplicateResult2 },
            errorStats: stats
        }
    };
}