// Draft Order ile özel fiyat sepete ekleme
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    
    const config = {
      height: formData.get('height'),
      width: formData.get('width'),
      material: formData.get('material'),
      calculatedPrice: parseFloat(formData.get('calculatedPrice')),
      variantId: formData.get('variantId')
    };
    
    console.log('📦 Creating draft order with calculated price:', config);
    
    // Draft Order oluştur
    const draftOrderResponse = await admin.graphql(`
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            invoiceUrl
            totalPrice
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        input: {
          lineItems: [
            {
              variantId: `gid://shopify/ProductVariant/${config.variantId}`,
              quantity: 1,
              customAttributes: [
                { key: "Yükseklik", value: `${config.height} cm` },
                { key: "Genişlik", value: `${config.width} cm` },
                { key: "Malzeme", value: config.material },
                { key: "Hesaplanan Fiyat", value: `${config.calculatedPrice}₺` },
                { key: "Özel Ürün", value: "Konfigüratör ile oluşturuldu" }
              ],
              // Özel fiyat uygula
              appliedDiscount: {
                description: "Özel hesaplanan fiyat",
                value: config.calculatedPrice,
                valueType: "FIXED_AMOUNT"
              }
            }
          ],
          useCustomerDefaultAddress: true
        }
      }
    });
    
    const result = draftOrderResponse.body.data.draftOrderCreate;
    
    if (result.userErrors?.length > 0) {
      console.error('❌ Draft order errors:', result.userErrors);
      return new Response(JSON.stringify({ 
        success: false, 
        errors: result.userErrors 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const draftOrder = result.draftOrder;
    console.log('✅ Draft order created:', draftOrder.id);
    
    // Draft order'ı invoice URL'ine yönlendir
    return new Response(JSON.stringify({
      success: true,
      draftOrderId: draftOrder.id,
      invoiceUrl: draftOrder.invoiceUrl,
      totalPrice: draftOrder.totalPrice,
      message: "Özel fiyatlı ürün sepete eklendi"
    }), {
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error('❌ Draft order creation error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}