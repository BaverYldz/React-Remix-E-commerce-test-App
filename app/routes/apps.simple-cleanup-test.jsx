// Simple cleanup test - no external imports
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
    try {
        const { admin } = await authenticate.admin(request);

        console.log('Simple cleanup test starting...');

        // 1. Find temporary products with geçici-ürün tag
        const query = `
            query {
                products(first: 10, query: "tag:geçici-ürün") {
                    edges {
                        node {
                            id
                            title
                            tags
                            createdAt
                        }
                    }
                }
            }
        `;

        const response = await admin.graphql(query);
        const result = await response.json();

        const products = result.data?.products?.edges || [];

        console.log(`Found ${products.length} temporary products`);

        return json({
            success: true,
            message: `Found ${products.length} temporary products`,
            products: products.map(edge => ({
                id: edge.node.id,
                title: edge.node.title,
                createdAt: edge.node.createdAt
            }))
        });

    } catch (error) {
        console.error('Simple test failed:', error);
        return json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

export default function SimpleCleanupTest() {
    return (
        <div style={{ padding: '20px' }}>
            <h1>Simple Cleanup Test</h1>
            <button
                onClick={() => {
                    fetch('/apps/simple-cleanup-test', { method: 'POST' })
                        .then(r => r.json())
                        .then(data => {
                            alert('Result:\n' + JSON.stringify(data, null, 2));
                        })
                        .catch(err => alert('Error: ' + err.message));
                }}
                style={{
                    padding: '12px 24px',
                    backgroundColor: '#2c3e50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#34495e';
                }}
                onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#2c3e50';
                }}
            >
                List Temporary Products
            </button>
        </div>
    );
}