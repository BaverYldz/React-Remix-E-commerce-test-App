import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// Geçici ürünleri temizleme fonksiyonu
async function cleanupExpiredProducts(admin) {
  const currentTime = Date.now();
  const cleanedProducts = [];
  
  try {
    // Geçici etiketine sahip ürünleri bul
    const response = await admin.graphql(`
      query getTemporaryProducts {
        products(first: 250, query: "tag:geçici-ürün") {
          edges {
            node {
              id
              title
              tags
              createdAt
              metafield(namespace: "custom", key: "temp_product_delete_at") {
                value
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `);
    
    const data = await response.json();
    const products = data.data?.products?.edges || [];
    
    for (const productEdge of products) {
      const product = productEdge.node;
      
      // Tag'lerden expire zamanını çıkar (fallback)
      let deleteTime = null;
      
      // Önce metafield'dan kontrol et
      if (product.metafield?.value) {
        deleteTime = parseInt(product.metafield.value);
      } else {
        // Tag'lerden expire zamanını bul
        const expireTag = product.tags.find(tag => tag.startsWith('expires-'));
        if (expireTag) {
          deleteTime = parseInt(expireTag.replace('expires-', ''));
        }
      }
      
      // Eğer süresi dolmuşsa sil
      if (deleteTime && deleteTime <= currentTime) {
        try {
          const deleteResponse = await admin.graphql(`
            mutation deleteProduct($id: ID!) {
              productDelete(input: {id: $id}) {
                deletedProductId
                userErrors {
                  field
                  message
                }
              }
            }
          `, {
            variables: { id: product.id }
          });
          
          const deleteData = await deleteResponse.json();
          
          if (deleteData.data?.productDelete?.deletedProductId) {
            cleanedProducts.push({
              id: product.id,
              title: product.title,
              deletedAt: new Date().toISOString()
            });
            console.log(`Geçici ürün silindi: ${product.title} (${product.id})`);
          } else {
            console.error(`Ürün silinemedi: ${product.title}`, deleteData.data?.productDelete?.userErrors);
          }
          
        } catch (deleteError) {
          console.error(`Ürün silme hatası: ${product.title}`, deleteError);
        }
      }
    }
    
    return cleanedProducts;
    
  } catch (error) {
    console.error("Temizlik işlemi hatası:", error);
    throw error;
  }
}

// Günlük temizlik taraması (Task 17)
async function dailyCleanupScan(admin) {
  const yesterday = Date.now() - (24 * 60 * 60 * 1000);
  
  try {
    // Tüm geçici ürünleri bul (24+ saat önce oluşturulanlar)
    const response = await admin.graphql(`
      query getOldTemporaryProducts {
        products(first: 250, query: "tag:geçici-ürün AND created_at:<${new Date(yesterday).toISOString()}") {
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
    
    console.log(`Günlük tarama: ${products.length} eski geçici ürün bulundu`);
    
    const deletedProducts = [];
    
    for (const productEdge of products) {
      const product = productEdge.node;
      
      try {
        const deleteResponse = await admin.graphql(`
          mutation deleteProduct($id: ID!) {
            productDelete(input: {id: $id}) {
              deletedProductId
              userErrors {
                field
                message
              }
            }
          }
        `, {
          variables: { id: product.id }
        });
        
        const deleteData = await deleteResponse.json();
        
        if (deleteData.data?.productDelete?.deletedProductId) {
          deletedProducts.push({
            id: product.id,
            title: product.title,
            createdAt: product.createdAt,
            deletedAt: new Date().toISOString()
          });
        }
        
      } catch (deleteError) {
        console.error(`Günlük tarama silme hatası: ${product.title}`, deleteError);
      }
    }
    
    return deletedProducts;
    
  } catch (error) {
    console.error("Günlük tarama hatası:", error);
    throw error;
  }
}

// Zamanlayıcı endpoint
export async function action({ request }) {
  try {
    const { admin } = await authenticate.admin(request);
    
    const body = await request.json();
    const { action: actionType } = body;
    
    let result = {};
    
    if (actionType === 'cleanup') {
      // Normal temizlik (2 saat sonra)
      const cleanedProducts = await cleanupExpiredProducts(admin);
      result = {
        success: true,
        action: 'cleanup',
        cleanedCount: cleanedProducts.length,
        cleanedProducts
      };
    } else if (actionType === 'daily-scan') {
      // Günlük tarama (24 saat sonra)
      const deletedProducts = await dailyCleanupScan(admin);
      result = {
        success: true,
        action: 'daily-scan', 
        deletedCount: deletedProducts.length,
        deletedProducts
      };
    } else {
      return json({
        success: false,
        error: "Geçersiz aksiyon. 'cleanup' veya 'daily-scan' kullanın."
      }, { status: 400 });
    }
    
    return json(result);
    
  } catch (error) {
    console.error("Cleanup endpoint error:", error);
    return json({
      success: false,
      error: error.message || "Temizlik işlemi başarısız"
    }, { status: 500 });
  }
}

// Durumu kontrol etme endpoint
export async function loader({ request }) {
  try {
    const { admin } = await authenticate.admin(request);
    
    // Mevcut geçici ürün sayısını al
    const response = await admin.graphql(`
      query getTemporaryProductsCount {
        products(first: 250, query: "tag:geçici-ürün") {
          edges {
            node {
              id
              title
              createdAt
              metafield(namespace: "custom", key: "temp_product_delete_at") {
                value
              }
            }
          }
        }
      }
    `);
    
    const data = await response.json();
    const products = data.data?.products?.edges || [];
    
    const currentTime = Date.now();
    const expiredCount = products.filter(p => {
      const product = p.node;
      let deleteTime = null;
      
      if (product.metafield?.value) {
        deleteTime = parseInt(product.metafield.value);
      } else {
        const expireTag = product.tags.find(tag => tag.startsWith('expires-'));
        if (expireTag) {
          deleteTime = parseInt(expireTag.replace('expires-', ''));
        }
      }
      
      return deleteTime && deleteTime <= currentTime;
    }).length;
    
    return json({
      totalTemporaryProducts: products.length,
      expiredProducts: expiredCount,
      needsCleanup: expiredCount > 0,
      lastCheck: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Cleanup status error:", error);
    return json({
      error: error.message || "Durum kontrolü başarısız"
    }, { status: 500 });
  }
}