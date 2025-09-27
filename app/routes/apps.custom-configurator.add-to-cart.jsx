import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// Fiyatlama kuralları (Task 7)
const PRICING_RULES = {
  // Boy x En aralıklarına göre katsayılar
  sizeMultipliers: [
    { minArea: 0, maxArea: 0.1, multiplier: 1.5 },      // 0-0.1 m² (küçük)
    { minArea: 0.1, maxArea: 0.5, multiplier: 1.2 },    // 0.1-0.5 m² (orta)
    { minArea: 0.5, maxArea: 2, multiplier: 1.0 },      // 0.5-2 m² (standart)
    { minArea: 2, maxArea: 5, multiplier: 0.9 },        // 2-5 m² (büyük)
    { minArea: 5, maxArea: Infinity, multiplier: 0.8 }   // 5+ m² (çok büyük)
  ],
  
  // Materyal fiyatları (m² başına)
  materials: {
    "Ahşap": 25,
    "Metal": 35, 
    "PVC": 20,
    "Cam": 45
  }
};

// Fiyat hesaplama fonksiyonu
function calculatePrice(height, width, material) {
  const area = (height * width) / 10000; // cm² to m²
  
  // Materyal fiyatı
  const materialPrice = PRICING_RULES.materials[material];
  if (!materialPrice) {
    throw new Error("Geçersiz materyal seçimi");
  }
  
  // Alan katsayısı bul
  const sizeRule = PRICING_RULES.sizeMultipliers.find(
    rule => area >= rule.minArea && area < rule.maxArea
  );
  
  if (!sizeRule) {
    throw new Error("Geçersiz alan ölçüsü");
  }
  
  // Toplam fiyat = Alan × Materyal fiyatı × Alan katsayısı
  return area * materialPrice * sizeRule.multiplier;
}

// Geçici ürün oluşturma fonksiyonu
async function createTemporaryProduct(admin, config) {
  const { height, width, material } = config;
  
  const price = calculatePrice(height, width, material);
  const productTitle = `Özel Çerçeve ${height}×${width}cm - ${material}`;
  
  // Geçici ürün oluştur
  const response = await admin.graphql(`
    mutation createProduct($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product {
          id
          title
          handle
          variants(first: 1) {
            edges {
              node {
                id
                price
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
        bodyHtml: `<p>Özel ölçü ürün - Boy: ${height}cm, En: ${width}cm, Materyal: ${material}</p>`,
        vendor: "Özel Üretim",
        productType: "Çerçeve",
        tags: ["geçici-ürün", "özel-ölçü", `expires-${Date.now() + (2 * 60 * 60 * 1000)}`], // 2 saat sonra silinecek
        status: "DRAFT", // Vitrine çıkmasın
        variants: [{
          price: price.toFixed(2),
          inventoryQuantity: 1,
          inventoryManagement: "SHOPIFY",
          inventoryPolicy: "DENY"
        }]
      }
    }
  });

  const data = await response.json();
  
  if (data.data?.productCreate?.userErrors?.length > 0) {
    throw new Error(data.data.productCreate.userErrors[0].message);
  }
  
  const product = data.data?.productCreate?.product;
  if (!product) {
    throw new Error("Ürün oluşturulamadı");
  }
  
  // Silme zamanını kaydet (Task 11)
  await saveProductForDeletion(admin, product.id, Date.now() + (2 * 60 * 60 * 1000));
  
  return product;
}

// Silinecek ürünleri kaydetme fonksiyonu
async function saveProductForDeletion(admin, productId, deleteAt) {
  // Bu örnekte metafield kullanıyoruz, gerçek uygulamada database tercih edilir
  try {
    await admin.graphql(`
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
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
          namespace: "custom",
          key: "temp_product_delete_at",
          type: "number_integer", 
          value: deleteAt.toString(),
          ownerId: productId
        }]
      }
    });
  } catch (error) {
    console.error("Silme zamanı kaydetme hatası:", error);
  }
}

export async function action({ request }) {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.json();
    
    const { height, width, material, productId } = formData;
    
    // Validasyon
    if (!height || !width || !material) {
      return json({ success: false, error: "Tüm alanları doldurun" }, { status: 400 });
    }
    
    if (height < 10 || height > 500 || width < 10 || width > 500) {
      return json({ success: false, error: "Ölçüler 10-500 cm arasında olmalıdır" }, { status: 400 });
    }
    
    // Geçici ürün oluştur (Task 9)
    const tempProduct = await createTemporaryProduct(admin, {
      height: parseInt(height),
      width: parseInt(width), 
      material,
      baseProductId: productId
    });
    
    // Başarılı response
    return json({
      success: true,
      product: tempProduct,
      message: "Ürün sepete eklendi!"
    });
    
  } catch (error) {
    console.error("Custom configurator error:", error);
    return json({ 
      success: false, 
      error: error.message || "Bir hata oluştu" 
    }, { status: 500 });
  }
}

// Fiyat hesaplama endpoint'i (canlı fiyat gösterimi için)
export async function loader({ request }) {
  try {
    await authenticate.admin(request);
    
    const url = new URL(request.url);
    const height = url.searchParams.get("height");
    const width = url.searchParams.get("width");
    const material = url.searchParams.get("material");
    
    if (!height || !width || !material) {
      return json({ price: 0 });
    }
    
    const price = calculatePrice(
      parseInt(height), 
      parseInt(width), 
      material
    );
    
    return json({ 
      price: price.toFixed(2),
      area: ((parseInt(height) * parseInt(width)) / 10000).toFixed(4) + " m²"
    });
    
  } catch (error) {
    console.error("Price calculation error:", error);
    return json({ price: 0, error: error.message });
  }
}