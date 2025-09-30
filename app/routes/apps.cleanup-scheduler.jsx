// Task 17: Günlük Temizlik Sistemi - Gelişmiş Scheduler
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
        const { OperationMonitor } = await import('../operation-monitor.js');
        const monitor = new OperationMonitor(admin);
        result = await monitor.performDailyCleanup();
        break;

      case 'manual_cleanup':
        // Import dinamik olarak
        const { TemporaryProductCleanup } = await import('../cleanup-system.js');
        const cleanup = new TemporaryProductCleanup(admin);
        result = await cleanup.runCleanup();
        break;

      case 'health_check':
        const { OperationMonitor: HealthMonitor } = await import('../operation-monitor.js');
        const healthMonitor = new HealthMonitor(admin);
        result = await healthMonitor.checkSystemHealth();
        break;

      case 'generate_report':
        const { OperationMonitor: ReportMonitor } = await import('../operation-monitor.js');
        const reportMonitor = new ReportMonitor(admin);
        result = {
          success: true,
          report: reportMonitor.generateDailyReport()
        };
        break;

      case 'export_logs':
        const hours = parseInt(formData.get('hours')) || 24;
        const { OperationMonitor: LogMonitor } = await import('../operation-monitor.js');
        const logMonitor = new LogMonitor(admin);
        result = {
          success: true,
          export: logMonitor.exportLogs('all', hours)
        };
        break;

      default:
        // Fallback to legacy cleanup
        result = await cleanupExpiredProducts(admin);
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

// Legacy cleanup function (fallback)
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