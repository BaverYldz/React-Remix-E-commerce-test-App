import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Card, Layout, Page, DataTable, Text, Badge } from "@shopify/polaris";

import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  try {
    const { admin } = await authenticate.admin(request);

    const res = await admin.graphql(`
      query {
        themes(first: 10) {
          edges {
            node {
              id
              name
              role
              createdAt
              updatedAt
            }
          }
        }
      }
    `);

    const data = await res.json();
    
    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      throw new Error("Failed to fetch themes");
    }

    return json({
      themes: data.data?.themes?.edges || [],
      error: null
    });
  } catch (error) {
    console.error("Loader error:", error);
    return json({
      themes: [],
      error: error.message || "Failed to load themes"
    });
  }
}

export default function Themes() {
  const { themes, error } = useLoaderData();

  if (error) {
    return (
      <Page title="Themes">
        <Layout>
          <Layout.Section>
            <Card>
              <Text variant="headingMd" as="h2" color="critical">
                Error loading themes
              </Text>
              <Text>{error}</Text>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const rows = themes.map((theme) => {
    const node = theme.node;
    const roleBadge = node.role === 'MAIN' ? 
      <Badge status="success">Main</Badge> : 
      <Badge>Unpublished</Badge>;
    
    return [
      node.name,
      roleBadge,
      new Date(node.createdAt).toLocaleDateString(),
      new Date(node.updatedAt).toLocaleDateString(),
    ];
  });

  return (
    <Page title="Themes">
      <Layout>
        <Layout.Section>
          <Card>
            <Text variant="headingMd" as="h2">
              Theme List ({themes.length} themes)
            </Text>
            {themes.length > 0 ? (
              <DataTable
                columnContentTypes={[
                  'text',
                  'text',
                  'text',
                  'text',
                ]}
                headings={[
                  'Name',
                  'Role',
                  'Created',
                  'Updated',
                ]}
                rows={rows}
              />
            ) : (
              <Text>No themes found. This might indicate missing permissions.</Text>
            )}
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Text variant="headingMd" as="h2">
              Permissions Test
            </Text>
            <Text>
              🎨 read_themes: {themes.length > 0 ? 'Working' : 'Check permissions'}
            </Text>
            <Text>
              📋 Raw data for debugging:
            </Text>
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f6f6f7', borderRadius: '4px' }}>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {JSON.stringify({ themes, error }, null, 2)}
              </pre>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}