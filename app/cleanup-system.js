// Geçici ürün temizlik sistemi

import { globalErrorHandler } from './error-handler';
import { ProductVisibilityManager } from './product-visibility-manager';

export class TemporaryProductCleanup {
    constructor(admin) {
        this.admin = admin;
        this.CLEANUP_TAG = 'geçici-ürün';
        this.EXPIRY_HOURS = 2;
        this.errorHandler = globalErrorHandler;
        this.visibilityManager = new ProductVisibilityManager(admin);
        this.operationLogs = [];
    }

    // Silme zamanını kaydet
    async markProductForCleanup(productId, customData = {}) {
        const operationId = `mark_cleanup_${productId}_${Date.now()}`;
        
        try {
            const expiryTime = new Date();
            expiryTime.setHours(expiryTime.getHours() + this.EXPIRY_HOURS);

            console.log(`📅 Marking product ${productId} for cleanup at:`, expiryTime.toISOString());

            // Ürünü vitrineden gizle
            await this.visibilityManager.hideTemporaryProduct(productId);

            // Shopify metafield ile silme zamanını kaydet
            const metafieldMutation = `
                mutation metafieldSet($metafields: [MetafieldsSetInput!]!) {
                    metafieldsSet(metafields: $metafields) {
                        metafields {
                            id
                            key
                            value
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }
            `;

            const variables = {
                metafields: [
                    {
                        ownerId: `gid://shopify/Product/${productId}`,
                        namespace: "custom",
                        key: "cleanup_at",
                        type: "date_time",
                        value: expiryTime.toISOString()
                    },
                    {
                        ownerId: `gid://shopify/Product/${productId}`,
                        namespace: "custom",
                        key: "created_by",
                        type: "single_line_text_field",
                        value: "configurator"
                    },
                    {
                        ownerId: `gid://shopify/Product/${productId}`,
                        namespace: "custom",
                        key: "operation_id",
                        type: "single_line_text_field",
                        value: operationId
                    },
                    {
                        ownerId: `gid://shopify/Product/${productId}`,
                        namespace: "custom",
                        key: "custom_data",
                        type: "json",
                        value: JSON.stringify(customData)
                    }
                ]
            };

            const response = await this.admin.graphql(metafieldMutation, { variables });
            const result = await response.json();

            if (result.data?.metafieldsSet?.userErrors?.length > 0) {
                throw new Error('Metafield creation failed: ' + JSON.stringify(result.data.metafieldsSet.userErrors));
            }

            // Log başarılı işlem
            this.logOperation('PRODUCT_MARKED', {
                productId,
                operationId,
                expiryTime: expiryTime.toISOString(),
                customData
            });

            console.log('Product marked for cleanup successfully');
            return {
                success: true,
                productId,
                operationId,
                expiryTime: expiryTime.toISOString()
            };

        } catch (error) {
            console.error('Failed to mark product for cleanup:', error);
            
            // Hata loglama
            this.logOperation('PRODUCT_MARK_FAILED', {
                productId,
                operationId,
                error: error.message
            });

            const formattedError = this.errorHandler.formatUserError(error, 'product_marking');
            
            return {
                success: false,
                productId,
                error: formattedError
            };
        }
    }

    // Silinmesi gereken ürünleri bul
    async findExpiredProducts() {
        console.log('🔍 Searching for expired products...');

        try {
            // Geçici ürünleri bul (tag ile)
            const query = `
                query getTemporaryProducts($tag: String!, $first: Int!) {
                    products(first: $first, query: $tag) {
                        edges {
                            node {
                                id
                                title
                                tags
                                createdAt
                                metafield(namespace: "custom", key: "cleanup_at") {
                                    value
                                }
                                orderMetafield: metafield(namespace: "custom", key: "order_status") {
                                    value
                                }
                            }
                        }
                    }
                }
            `;

            const variables = {
                tag: `tag:${this.CLEANUP_TAG}`,
                first: 50
            };

            const response = await this.admin.graphql(query, { variables });
            const result = await response.json();

            const products = result.data?.products?.edges || [];

            // Sürede dolmuş ürünleri filtrele
            const expiredProducts = products.filter(edge => {
                const product = edge.node;
                const cleanupAt = product.metafield?.value;

                if (!cleanupAt) {
                    // Metafield yoksa 2 saat üzerinden hesapla
                    const createdAt = new Date(product.createdAt);
                    const expiry = new Date(createdAt.getTime() + (this.EXPIRY_HOURS * 60 * 60 * 1000));
                    return new Date() > expiry;
                }

                return new Date() > new Date(cleanupAt);
            });

            console.log(`📊 Found ${expiredProducts.length} expired products out of ${products.length} temporary products`);

            // Log işlem
            this.logOperation('EXPIRED_PRODUCTS_FOUND', {
                totalProducts: products.length,
                expiredProducts: expiredProducts.length
            });

            return expiredProducts.map(edge => ({
                id: edge.node.id.replace('gid://shopify/Product/', ''),
                title: edge.node.title,
                expiredAt: edge.node.metafield?.value || 'calculated',
                hasOrder: edge.node.orderMetafield?.value === 'ordered'
            }));

        } catch (error) {
            console.error('Failed to find expired products:', error);
            
            this.logOperation('FIND_EXPIRED_FAILED', {
                error: error.message
            });
            
            return [];
        }
    }

    // Ürünleri sil
    async deleteExpiredProducts() {
        console.log('🧹 Starting cleanup process...');

        try {
            const expiredProducts = await this.findExpiredProducts();

            if (expiredProducts.length === 0) {
                console.log('✨ No expired products to clean up');
                
                this.logOperation('CLEANUP_COMPLETED', {
                    deleted: 0,
                    errors: 0,
                    total: 0,
                    reason: 'no_expired_products'
                });
                
                return { deleted: 0, errors: 0, total: 0 };
            }

            let deleted = 0;
            let errors = 0;
            const deletionResults = [];

            // Retry mekanizması ile silme
            for (const product of expiredProducts) {
                const deleteOperation = async () => {
                    console.log(`🗑️ Deleting expired product: ${product.title} (ID: ${product.id})`);

                    // Siparişe girmiş ürünler de silinebilir
                    if (product.hasOrder) {
                        console.log(`Product ${product.id} has order but will be deleted as planned`);
                    }

                    const deleteMutation = `
                        mutation productDelete($input: ProductDeleteInput!) {
                            productDelete(input: $input) {
                                deletedProductId
                                userErrors {
                                    field
                                    message
                                }
                            }
                        }
                    `;

                    const variables = {
                        input: {
                            id: `gid://shopify/Product/${product.id}`
                        }
                    };

                    const response = await this.admin.graphql(deleteMutation, { variables });
                    const result = await response.json();

                    if (result.data?.productDelete?.userErrors?.length > 0) {
                        throw new Error(`Delete failed: ${JSON.stringify(result.data.productDelete.userErrors)}`);
                    }

                    return result.data.productDelete.deletedProductId;
                };

                // Retry ile silme işlemi
                const retryResult = await this.errorHandler.retryOperation(
                    deleteOperation,
                    `delete_product_${product.id}`,
                    2 // 2 deneme
                );

                if (retryResult.success) {
                    console.log(`Successfully deleted product: ${product.title}`);
                    deleted++;
                    
                    deletionResults.push({
                        productId: product.id,
                        title: product.title,
                        status: 'success',
                        attempts: retryResult.attempts
                    });
                } else {
                    console.error(`Failed to delete product ${product.id}:`, retryResult.error);
                    errors++;
                    
                    deletionResults.push({
                        productId: product.id,
                        title: product.title,
                        status: 'failed',
                        error: retryResult.error.userMessage,
                        attempts: retryResult.attempts
                    });
                }

                // Rate limiting için bekle
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            console.log(`🏁 Cleanup completed: ${deleted} deleted, ${errors} errors`);

            // Sonuçları logla
            this.logOperation('CLEANUP_COMPLETED', {
                deleted,
                errors,
                total: expiredProducts.length,
                results: deletionResults,
                efficiency: deleted / expiredProducts.length * 100
            });

            return { 
                deleted, 
                errors, 
                total: expiredProducts.length,
                results: deletionResults 
            };

        } catch (error) {
            console.error('Cleanup process failed:', error);
            
            this.logOperation('CLEANUP_FAILED', {
                error: error.message
            });
            
            return {
                deleted: 0,
                errors: 1,
                total: 0,
                error: error.message
            };
        }
    }

    // Manual cleanup trigger
    async runCleanup() {
        console.log('Manual cleanup triggered');
        return await this.deleteExpiredProducts();
    }

    // İşlem loglama
    logOperation(type, data) {
        const logEntry = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: type,
            timestamp: new Date().toISOString(),
            data: data
        };

        this.operationLogs.push(logEntry);

        // Log boyutunu sınırla (son 500 entry)
        if (this.operationLogs.length > 500) {
            this.operationLogs.shift();
        }

        console.log(`📝 CLEANUP LOG [${type}]:`, data);
        return logEntry.id;
    }

    // Log export
    exportLogs(hours = 24) {
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - hours);

        const recentLogs = this.operationLogs.filter(log =>
            new Date(log.timestamp) > cutoff
        );

        return {
            exportedAt: new Date().toISOString(),
            timeFrame: `${hours} hours`,
            totalLogs: recentLogs.length,
            logs: recentLogs
        };
    }
}

// Basit zamanlayıcı (setInterval ile)
export function startCleanupScheduler(admin, intervalMinutes = 5) {
    const cleanup = new TemporaryProductCleanup(admin);

    console.log(`⏰ Starting cleanup scheduler - runs every ${intervalMinutes} minutes`);

    // İlk çalıştırma
    cleanup.runCleanup();

    // Periyodik çalıştırma
    const interval = setInterval(() => {
        cleanup.runCleanup();
    }, intervalMinutes * 60 * 1000);

    return interval;
}