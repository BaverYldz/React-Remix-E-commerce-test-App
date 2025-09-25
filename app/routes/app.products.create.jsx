import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { Card, Layout, Page, TextField, Button, Text, Banner } from "@shopify/polaris";
import { useState } from "react";

import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const title = formData.get("title");
  const description = formData.get("description");
  
  if (!title) {
    return json({ error: "Title is required" }, { status: 400 });
  }

  try {
    const res = await admin.graphql(`
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
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
          title,
          descriptionHtml: description || "",
          status: "DRAFT"
        }
      }
    });

    const data = await res.json();
    
    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      return json({ error: "GraphQL error occurred" }, { status: 500 });
    }

    if (data.data.productCreate.userErrors.length > 0) {
      return json({ 
        error: data.data.productCreate.userErrors[0].message 
      }, { status: 400 });
    }

    return redirect("/app/products");
  } catch (error) {
    console.error("Product creation error:", error);
    return json({ error: error.message }, { status: 500 });
  }
}

export default function CreateProduct() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  
  const isSubmitting = navigation.state === "submitting";

  return (
    <Page 
      title="Create Product"
      backAction={{ url: "/app/products" }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.error && (
            <Banner status="critical">
              {actionData.error}
            </Banner>
          )}
          
          <Card>
            <Form method="post">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <TextField
                  label="Product Title"
                  name="title"
                  value={title}
                  onChange={setTitle}
                  autoComplete="off"
                  required
                />
                
                <TextField
                  label="Description"
                  name="description"
                  value={description}
                  onChange={setDescription}
                  multiline={4}
                  autoComplete="off"
                />
                
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <Button 
                    url="/app/products"
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="primary"
                    submit
                    loading={isSubmitting}
                  >
                    Create Product
                  </Button>
                </div>
              </div>
            </Form>
          </Card>
          
          <Card>
            <Text variant="headingMd" as="h2">
              Permissions Test
            </Text>
            <Text>
              📝 write_products: This form tests product creation permissions
            </Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}