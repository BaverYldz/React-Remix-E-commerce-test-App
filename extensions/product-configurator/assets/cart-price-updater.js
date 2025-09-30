// Sepet sayfası için fiyat güncelleyici
document.addEventListener('DOMContentLoaded', function() {
  console.log('🛒 Cart price updater loaded');
  
  // Sepet sayfasında mı kontrol et
  if (!window.location.pathname.includes('/cart')) {
    return;
  }
  
  updateCartTotals();
  
  // Quantity değişikliklerini dinle
  const quantityInputs = document.querySelectorAll('input[name="updates[]"], .cart-item__quantity input');
  quantityInputs.forEach(input => {
    input.addEventListener('change', () => {
      setTimeout(updateCartTotals, 500);
    });
  });
});

function updateCartTotals() {
  console.log('💰 Updating cart totals...');
  
  let totalCalculated = 0;
  
  // Her sepet item'ını kontrol et
  const cartItems = document.querySelectorAll('[data-cart-item], .cart-item, .cart__item');
  
  cartItems.forEach((item, index) => {
    console.log('🔍 Processing cart item:', index);
    
    // Quantity bul
    const quantityInput = item.querySelector('input[name="updates[]"], .cart-item__quantity input, input[type="number"]');
    const quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;
    
    // Properties içinde hesaplanan fiyatı ara
    const properties = item.querySelectorAll('p, span, div');
    let calculatedPrice = null;
    
    properties.forEach(prop => {
      const text = prop.textContent || '';
      
      // "Fiyat: 400.00₺" formatını ara
      if (text.includes('Fiyat:') && (text.includes('₺') || text.includes('TL'))) {
        const priceMatch = text.match(/Fiyat:\s*([0-9]+(?:\.[0-9]+)?)/);
        if (priceMatch) {
          calculatedPrice = parseFloat(priceMatch[1]);
          console.log('💵 Found calculated price:', calculatedPrice, 'for quantity:', quantity);
        }
      }
    });
    
    if (calculatedPrice) {
      totalCalculated += calculatedPrice * quantity;
      
      // Bu item'ın toplam fiyatını güncelle
      const itemTotalElements = item.querySelectorAll('.cart-item__total, .cart-item__price, .money, [data-cart-item-price]');
      itemTotalElements.forEach(element => {
        if (element.textContent.includes('100.00') || element.textContent.includes('TL') || element.textContent.includes('₺')) {
          element.textContent = (calculatedPrice * quantity).toFixed(2) + '₺';
          element.style.color = '#e74c3c';
          element.style.fontWeight = 'bold';
        }
      });
    }
  });
  
  if (totalCalculated > 0) {
    console.log('🎯 Total calculated price:', totalCalculated);
    
    // Sepet toplamını güncelle
    const totalSelectors = [
      '.cart__total',
      '.cart-total',
      '.totals__total',
      '[data-cart-total]',
      '.cart-subtotal__price',
      '.cart__footer .money',
      '.cart-footer .money'
    ];
    
    totalSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (element && (element.textContent.includes('100.00') || element.textContent.includes('200.00'))) {
          element.textContent = totalCalculated.toFixed(2) + '₺';
          element.style.color = '#e74c3c';
          element.style.fontWeight = 'bold';
          
          // Başarı mesajı göster
          showPriceUpdateNotification(totalCalculated);
          
          console.log('✅ Updated total to:', totalCalculated.toFixed(2) + '₺');
        }
      });
    });
  }
}

function showPriceUpdateNotification(newTotal) {
  // Eğer zaten bir notification varsa kaldır
  const existing = document.querySelector('.price-update-notification');
  if (existing) {
    existing.remove();
  }
  
  // Yeni notification oluştur
  const notification = document.createElement('div');
  notification.className = 'price-update-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #2ecc71;
    color: white;
    padding: 15px 20px;
    border-radius: 5px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    z-index: 9999;
    font-weight: bold;
    animation: slideIn 0.3s ease-out;
  `;
  
  notification.innerHTML = `
    <div>✅ Fiyat güncellendi!</div>
    <div>Yeni toplam: ${newTotal.toFixed(2)}₺</div>
  `;
  
  // CSS animasyonu ekle
  if (!document.querySelector('#price-update-styles')) {
    const style = document.createElement('style');
    style.id = 'price-update-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // 3 saniye sonra kaldır
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Checkout butonunu dinle ve fiyat uyarısı göster
document.addEventListener('click', function(e) {
  if (e.target.matches('.btn--checkout, [name="add"], .cart__checkout-button, .checkout-button')) {
    console.log('🛒 Checkout clicked - prices should be updated');
    
    // Son bir kez fiyatları güncelle
    setTimeout(updateCartTotals, 100);
  }
});