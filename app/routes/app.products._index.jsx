import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Card, Layout, Page, DataTable, Text } from "@shopify/polaris";

import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  try {
    const { admin } = await authenticate.admin(request);

    const res = await admin.graphql(`
      query {
        products(first: 10) {
          edges {
            node {
              id
              title
              handle
              status
              createdAt
              updatedAt
              tags
              totalInventory
              vendor
            }
          }
        }
      }
    `);

    const data = await res.json();
    
    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      throw new Error("Failed to fetch products");
    }

    return json({
      products: data.data?.products?.edges || [],
      error: null
    });
  } catch (error) {
    console.error("Loader error:", error);
    return json({
      products: [],
      error: error.message || "Failed to load products"
    });
  }
}

export default function Products() {
  const { products, error } = useLoaderData();

  if (error) {
    return (
      <Page title="Products">
        <Layout>
          <Layout.Section>
            <Card>
              <Text variant="headingMd" as="h2" color="critical">
                Error loading products
              </Text>
              <Text>{error}</Text>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const rows = products.map((product) => {
    const node = product.node;
    return [
      node.title,
      node.handle,
      node.status,
      node.vendor || "N/A",
      node.totalInventory || 0,
      new Date(node.createdAt).toLocaleDateString(),
    ];
  });

  return (
    <Page 
      title="Products"
      primaryAction={{
        content: 'Create Product',
        url: '/app/products/create'
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Text variant="headingMd" as="h2">
              Product List ({products.length} products)
            </Text>
            {products.length > 0 ? (
              <DataTable
                columnContentTypes={[
                  'text',
                  'text', 
                  'text',
                  'text',
                  'numeric',
                  'text',
                ]}
                headings={[
                  'Title',
                  'Handle',
                  'Status',
                  'Vendor',
                  'Inventory',
                  'Created',
                ]}
                rows={rows}
              />
            ) : (
              <Text>No products found. This might indicate missing permissions or an empty store.</Text>
            )}
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Text variant="headingMd" as="h2">
              Permissions Test
            </Text>
            <Text>
              ✅ read_products: {products.length > 0 ? 'Working' : 'Check permissions'}
            </Text>
            <Text>
              📋 Raw data for debugging:
            </Text>
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f6f6f7', borderRadius: '4px' }}>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {JSON.stringify({ products, error }, null, 2)}
              </pre>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
