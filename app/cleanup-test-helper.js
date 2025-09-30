// Expired Product Simülâsyonu
// Manual cleanup test için expired product oluştur

export async function createExpiredTestProduct(admin) {
    console.log('🧪 Creating expired test product for cleanup simulation...');

    try {
        // 3 saat önce "oluşturulmuş" ürün simülasyonu
        const expiredTime = new Date();
        expiredTime.setHours(expiredTime.getHours() - 3); // 3 saat önce

        const productTitle = `TEST Expired Product - ${Date.now()}`;

        const response = await admin.graphql(`
            mutation createProduct($product: ProductCreateInput!) {
                productCreate(product: $product) {
                    product {
                        id
                        title
                        variants(first: 1) {
                            edges {
                                node {
                                    id
                                }
                            }
                        }
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `, {
            variables: {
                product: {
                    title: productTitle,
                    bodyHtml: '<p>Test ürünü - 3 saat önce oluşturulmuş (simülasyon)</p>',
                    vendor: "Test Cleanup",
                    productType: "Test",
                    tags: ["geçici-ürün", "test-expired"],
                    status: "DRAFT",
                    variants: [{
                        price: "1.00",
                        inventoryQuantity: 1
                    }]
                }
            }
        });

        const result = await response.json();
        const product = result.data?.productCreate?.product;

        if (!product) {
            throw new Error('Test product creation failed');
        }

        // Metafield ile expired time set et
        const productIdNumber = product.id.replace('gid://shopify/Product/', '');

        await admin.graphql(`
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
        `, {
            variables: {
                metafields: [{
                    ownerId: product.id,
                    namespace: "custom",
                    key: "cleanup_at",
                    type: "date_time",
                    value: expiredTime.toISOString()
                }]
            }
        });

        console.log('✅ Test expired product created:', productTitle);
        console.log('📅 Expired at:', expiredTime.toISOString());

        return {
            id: productIdNumber,
            title: productTitle,
            expiredAt: expiredTime.toISOString()
        };

    } catch (error) {
        console.error('❌ Failed to create test expired product:', error);
        throw error;
    }
}

// Test cleanup endpoint
export async function testCleanupSystem(admin) {
    console.log('🧹 Testing cleanup system...');

    try {
        // 1. Expired test product oluştur
        const testProduct = await createExpiredTestProduct(admin);
        console.log('Test product created:', testProduct);

        // 2. Cleanup çalıştır
        const { TemporaryProductCleanup } = await import('./cleanup-system.js');
        const cleanup = new TemporaryProductCleanup(admin);

        console.log('Running cleanup...');
        const result = await cleanup.runCleanup();

        console.log('✅ Cleanup test completed:', result);

        return {
            testProduct,
            cleanupResult: result,
            success: result.deleted > 0
        };

    } catch (error) {
        console.error('❌ Cleanup test failed:', error);
        return { success: false, error: error.message };
    }
}