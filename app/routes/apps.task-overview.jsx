// Ana kontrol paneli
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
    try {
        const { admin } = await authenticate.admin(request);

        // Geçici ürünleri kontrol et
        const response = await admin.graphql(`
            query getTemporaryProducts {
                products(first: 10, query: "tag:geçici-ürün") {
                    edges {
                        node {
                            id
                            title
                            createdAt
                            status
                        }
                    }
                }
            }
        `);
        
        const result = await response.json();
        const tempProducts = result.data?.products?.edges || [];
        
        return json({
            success: true,
            tempProductCount: tempProducts.length,
            tempProducts: tempProducts.map(edge => ({
                id: edge.node.id.replace('gid://shopify/Product/', ''),
                title: edge.node.title,
                createdAt: edge.node.createdAt,
                status: edge.node.status
            })),
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        return json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

export default function TaskOverview() {
    const data = useLoaderData();

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '30px', textAlign: 'center' }}>
                <h1 style={{ color: '#2c3e50', marginBottom: '10px' }}>
                    Ürün Konfigüratör Dashboard
                </h1>
                <p style={{ color: '#6c757d', fontSize: '16px' }}>
                    Sistem durumu ve yönetim paneli
                </p>
            </header>

            {/* Sistem Durumu */}
            <section style={{ marginBottom: '40px' }}>
                <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>Sistem Durumu</h2>
                
                {data.success ? (
                    <div style={{ 
                        backgroundColor: '#d4edda', 
                        border: '1px solid #c3e6cb',
                        borderRadius: '8px',
                        padding: '20px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#155724' }}>
                                Sistem Çalışıyor
                            </span>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                            <InfoCard 
                                title="Geçici Ürünler" 
                                value={data.tempProductCount} 
                            />
                            <InfoCard 
                                title="Otomatik Temizlik" 
                                value="Aktif" 
                            />
                            <InfoCard 
                                title="Son Kontrol" 
                                value={new Date(data.timestamp).toLocaleTimeString('tr-TR')} 
                            />
                        </div>
                    </div>
                ) : (
                    <div style={{ 
                        backgroundColor: '#f8d7da', 
                        border: '1px solid #f5c6cb',
                        borderRadius: '8px',
                        padding: '20px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#721c24' }}>
                                Bağlantı Hatası: {data.error}
                            </span>
                        </div>
                    </div>
                )}
            </section>

            {/* Hızlı İşlemler */}
            <section style={{ marginBottom: '40px' }}>
                <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>Hızlı İşlemler</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <ActionCard
                        title="Sistem Testi"
                        description="Tüm bileşenleri test et"
                        link="/apps/task-11-18-tests"
                        color="#2c3e50"
                    />
                    
                    <ActionCard
                        title="Manuel Temizlik"
                        description="Eski ürünleri hemen sil"
                        link="/apps/cleanup-scheduler-new"
                        color="#2c3e50"
                    />
                    
                    <ActionCard
                        title="Basit Test"
                        description="Temel işlevsellik kontrolü"
                        link="/apps/simple-cleanup-test"
                        color="#2c3e50"
                    />
                </div>
            </section>

            {/* Geçici Ürünler */}
            {data.success && data.tempProducts?.length > 0 && (
                <section style={{ marginBottom: '40px' }}>
                    <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>Aktif Geçici Ürünler</h2>
                    
                    <div style={{ 
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #dee2e6',
                        borderRadius: '8px',
                        overflow: 'hidden'
                    }}>
                        {data.tempProducts.map((product, index) => (
                            <div 
                                key={product.id}
                                style={{ 
                                    padding: '15px',
                                    borderBottom: index < data.tempProducts.length - 1 ? '1px solid #dee2e6' : 'none',
                                    backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                                            {product.title}
                                        </div>
                                        <div style={{ fontSize: '14px', color: '#6c757d' }}>
                                            ID: {product.id} | Durum: {product.status}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '14px', color: '#6c757d' }}>
                                        {new Date(product.createdAt).toLocaleString('tr-TR')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer style={{ 
                marginTop: '50px',
                padding: '20px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                textAlign: 'center',
                border: '1px solid #dee2e6'
            }}>
                <p style={{ margin: '0', color: '#6c757d' }}>
                    Shopify Product Configurator v1.0
                </p>
                <small style={{ color: '#adb5bd' }}>
                    Son güncelleme: {new Date().toLocaleString('tr-TR')}
                </small>
            </footer>
        </div>
    );
}

function InfoCard({ title, value }) {
    return (
        <div style={{ 
            backgroundColor: 'white',
            padding: '15px',
            borderRadius: '6px',
            border: '1px solid #dee2e6',
            textAlign: 'center'
        }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '5px' }}>
                {value}
            </div>
            <div style={{ fontSize: '14px', color: '#6c757d' }}>
                {title}
            </div>
        </div>
    );
}

function ActionCard({ title, description, link, color }) {
    return (
        <Link
            to={link}
            style={{
                display: 'block',
                padding: '20px',
                backgroundColor: color,
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'transform 0.2s ease',
                cursor: 'pointer'
            }}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
            <div>
                <h3 style={{ margin: '0 0 8px 0', color: 'white' }}>
                    {title}
                </h3>
                <p style={{ margin: '0', color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
                    {description}
                </p>
            </div>
        </Link>
    );
}