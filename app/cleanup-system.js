// Task 11-13: Geçici Ürün Temizlik Sistemi
// Database kullanmadan Shopify metafields ile çözüm

export class TemporaryProductCleanup {
    constructor(admin) {
        this.admin = admin;
        this.CLEANUP_TAG = 'geçici-ürün';
        this.EXPIRY_HOURS = 2;
    }

    // Task 11: Silme zamanını kaydet
    async markProductForCleanup(productId) {
        const expiryTime = new Date();
        expiryTime.setHours(expiryTime.getHours() + this.EXPIRY_HOURS);
        
        console.log(`📅 Marking product ${productId} for cleanup at:`, expiryTime.toISOString());
        
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
                }
            ]
        };

        try {
            const response = await this.admin.graphql(metafieldMutation, { variables });
            const result = await response.json();
            
            if (result.data?.metafieldsSet?.userErrors?.length > 0) {
                console.error('❌ Metafield error:', result.data.metafieldsSet.userErrors);
                return false;
            }
            
            console.log('✅ Product marked for cleanup successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to mark product for cleanup:', error);
            return false;
        }
    }

    // Task 12: Silinmesi gereken ürünleri bul
    async findExpiredProducts() {
        const now = new Date().toISOString();
        
        console.log('🔍 Searching for expired products...');
        
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
                        }
                    }
                }
            }
        `;

        const variables = {
            tag: `tag:${this.CLEANUP_TAG}`,
            first: 50
        };

        try {
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
            
            return expiredProducts.map(edge => ({
                id: edge.node.id.replace('gid://shopify/Product/', ''),
                title: edge.node.title,
                expiredAt: edge.node.metafield?.value || 'calculated'
            }));
            
        } catch (error) {
            console.error('❌ Failed to find expired products:', error);
            return [];
        }
    }

    // Task 12 & 13: Ürünleri sil
    async deleteExpiredProducts() {
        console.log('🧹 Starting cleanup process...');
        
        const expiredProducts = await this.findExpiredProducts();
        
        if (expiredProducts.length === 0) {
            console.log('✨ No expired products to clean up');
            return { deleted: 0, errors: 0 };
        }

        let deleted = 0;
        let errors = 0;

        for (const product of expiredProducts) {
            try {
                console.log(`🗑️ Deleting expired product: ${product.title} (ID: ${product.id})`);
                
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
                    console.error(`❌ Failed to delete product ${product.id}:`, result.data.productDelete.userErrors);
                    errors++;
                } else {
                    console.log(`✅ Successfully deleted product: ${product.title}`);
                    deleted++;
                }

                // Rate limiting için bekle
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ Error deleting product ${product.id}:`, error);
                errors++;
            }
        }

        console.log(`🏁 Cleanup completed: ${deleted} deleted, ${errors} errors`);
        
        return { deleted, errors, total: expiredProducts.length };
    }

    // Task 12: Manual cleanup trigger (for testing)
    async runCleanup() {
        console.log('🚀 Manual cleanup triggered');
        return await this.deleteExpiredProducts();
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