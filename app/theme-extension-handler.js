// Theme App Extension Message Handler

document.addEventListener('DOMContentLoaded', function () {
    console.log('🎧 Setting up Theme App Extension message listener...');

    // postMessage listener
    window.addEventListener('message', function (event) {
        console.log('📨 Received message:', event.data);

        if (event.data.type === 'CUSTOM_CONFIGURATOR_ADD_TO_CART') {
            handleCustomConfiguratorAddToCart(event.data.data);
        }
    });

    async function handleCustomConfiguratorAddToCart(config) {
        console.log('🛒 Handling custom configurator add to cart:', config);

        try {
            const response = await fetch('/apps/custom-configurator/add-to-cart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(config)
            });

            const data = await response.json();
            console.log('✅ Add to cart response:', data);

            if (data.success) {
                // Başarılı - sepete yönlendir
                if (data.redirectUrl) {
                    window.location.href = data.redirectUrl;
                } else {
                    window.location.href = '/cart';
                }
            } else {
                console.error('❌ Add to cart failed:', data.error);
                alert('Sepete eklenirken hata oluştu: ' + data.error);
            }

        } catch (error) {
            console.error('❌ Message handler error:', error);
            alert('Bağlantı hatası: ' + error.message);
        }
    }

    console.log('✅ Theme App Extension message handler ready');
});