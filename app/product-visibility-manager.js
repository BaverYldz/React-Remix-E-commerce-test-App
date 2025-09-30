// Ürün görünürlük yönetimi

export class ProductVisibilityManager {
    constructor(admin) {
        this.admin = admin;
        this.TEMP_TAG = 'geçici-ürün';
        this.HIDDEN_TAG = 'hidden-from-search';
        this.INTERNAL_TAG = 'internal-use-only';
    }

    // Geçici ürünü gizle
    async hideTemporaryProduct(productId) {
        console.log(`🙈 Hiding temporary product from storefront: ${productId}`);

        try {
            // 1. Ürünü DRAFT status yap (published değil)
            // 2. Gizleme tag'leri ekle
            // 3. Metafield ile arama sonuçlarından çıkar

            const updateMutation = `
                mutation productUpdate($input: ProductInput!) {
                    productUpdate(input: $input) {
                        product {
                            id
                            title
                            status
                            tags
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }
            `;

            // Önce mevcut ürün bilgilerini al
            const productQuery = `
                query getProduct($id: ID!) {
                    product(id: $id) {
                        id
                        title
                        tags
                        status
                    }
                }
            `;

            const queryResponse = await this.admin.graphql(productQuery, {
                variables: { id: `gid://shopify/Product/${productId}` }
            });
            const queryResult = await queryResponse.json();

            const currentProduct = queryResult.data?.product;
            if (!currentProduct) {
                throw new Error(`Product ${productId} not found`);
            }

            // Mevcut tag'ları al ve gizleme tag'larını ekle
            const currentTags = currentProduct.tags || [];
            const newTags = [
                ...currentTags,
                this.HIDDEN_TAG,
                this.INTERNAL_TAG,
                'noindex', // SEO için
                'exclude-sitemap' // Sitemap'ten çıkar
            ].filter((tag, index, arr) => arr.indexOf(tag) === index); // Duplicate'ları temizle

            const updateVariables = {
                input: {
                    id: `gid://shopify/Product/${productId}`,
                    status: 'DRAFT', // Vitrinede görünmez
                    tags: newTags
                }
            };

            const updateResponse = await this.admin.graphql(updateMutation, { variables: updateVariables });
            const updateResult = await updateResponse.json();

            if (updateResult.data?.productUpdate?.userErrors?.length > 0) {
                throw new Error('Product update failed: ' + JSON.stringify(updateResult.data.productUpdate.userErrors));
            }

            // Metafield ile ek gizleme bilgileri
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

            const metaVariables = {
                metafields: [
                    {
                        ownerId: `gid://shopify/Product/${productId}`,
                        namespace: "seo",
                        key: "hidden",
                        type: "boolean",
                        value: "true"
                    },
                    {
                        ownerId: `gid://shopify/Product/${productId}`,
                        namespace: "search",
                        key: "exclude",
                        type: "boolean",
                        value: "true"
                    },
                    {
                        ownerId: `gid://shopify/Product/${productId}`,
                        namespace: "custom",
                        key: "visibility_level",
                        type: "single_line_text_field",
                        value: "internal_only"
                    }
                ]
            };

            await this.admin.graphql(metafieldMutation, { variables: metaVariables });

            console.log(`✅ Product ${productId} successfully hidden from storefront`);

            return {
                success: true,
                productId: productId,
                status: 'DRAFT',
                tags: newTags,
                message: 'Product hidden from storefront successfully'
            };

        } catch (error) {
            console.error(`❌ Failed to hide product ${productId}:`, error);
            return {
                success: false,
                productId: productId,
                error: error.message
            };
        }
    }

    // Gizlenmiş geçici ürünleri listele
    async listHiddenTemporaryProducts() {
        try {
            const query = `
                query getHiddenProducts($tag: String!, $first: Int!) {
                    products(first: $first, query: $tag) {
                        edges {
                            node {
                                id
                                title
                                status
                                tags
                                createdAt
                                metafield(namespace: "custom", key: "visibility_level") {
                                    value
                                }
                            }
                        }
                    }
                }
            `;

            const variables = {
                tag: `tag:${this.TEMP_TAG}`,
                first: 50
            };

            const response = await this.admin.graphql(query, { variables });
            const result = await response.json();

            const products = result.data?.products?.edges || [];

            return {
                success: true,
                total: products.length,
                products: products.map(edge => ({
                    id: edge.node.id.replace('gid://shopify/Product/', ''),
                    title: edge.node.title,
                    status: edge.node.status,
                    isHidden: edge.node.tags.includes(this.HIDDEN_TAG),
                    visibilityLevel: edge.node.metafield?.value || 'not_set',
                    createdAt: edge.node.createdAt
                }))
            };

        } catch (error) {
            console.error('❌ Failed to list hidden products:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Vitrinede görünebilir mi kontrol et
    async checkProductVisibility(productId) {
        try {
            const query = `
                query getProduct($id: ID!) {
                    product(id: $id) {
                        id
                        title
                        status
                        tags
                        metafield(namespace: "seo", key: "hidden") {
                            value
                        }
                    }
                }
            `;

            const response = await this.admin.graphql(query, {
                variables: { id: `gid://shopify/Product/${productId}` }
            });
            const result = await response.json();

            const product = result.data?.product;
            if (!product) {
                return { visible: false, reason: 'Product not found' };
            }

            const isPublished = product.status === 'ACTIVE';
            const hasHiddenTag = product.tags.includes(this.HIDDEN_TAG);
            const hasInternalTag = product.tags.includes(this.INTERNAL_TAG);
            const seoHidden = product.metafield?.value === 'true';

            const visible = isPublished && !hasHiddenTag && !hasInternalTag && !seoHidden;

            return {
                visible: visible,
                productId: productId,
                status: product.status,
                checks: {
                    isPublished: isPublished,
                    hasHiddenTag: hasHiddenTag,
                    hasInternalTag: hasInternalTag,
                    seoHidden: seoHidden
                },
                reason: visible ? 'Product is visible' : 'Product is hidden from storefront'
            };

        } catch (error) {
            return {
                visible: false,
                error: error.message
            };
        }
    }
}

// Test fonksiyonları
export async function testProductVisibility(admin) {
    console.log('🧪 Testing Task 14: Product visibility management...');

    const manager = new ProductVisibilityManager(admin);

    try {
        // Gizlenmiş ürünleri listele
        const hiddenProducts = await manager.listHiddenTemporaryProducts();
        console.log('📋 Hidden temporary products:', hiddenProducts);

        if (hiddenProducts.products && hiddenProducts.products.length > 0) {
            // İlk ürünün görünürlüğünü kontrol et
            const firstProduct = hiddenProducts.products[0];
            const visibility = await manager.checkProductVisibility(firstProduct.id);
            console.log(`👁️ Visibility check for ${firstProduct.title}:`, visibility);
        }

        return {
            success: true,
            message: 'Task 14 visibility test completed',
            results: hiddenProducts
        };

    } catch (error) {
        console.error('❌ Task 14 test failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}