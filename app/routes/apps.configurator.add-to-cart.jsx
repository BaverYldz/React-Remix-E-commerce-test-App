import { json } from "@remix-run/node";

export async function loader({ request }) {
  console.log("🔄 Configurator proxy GET:", request.url);
  return json({
    message: "Custom Configurator Proxy Active",
    timestamp: new Date().toISOString()
  });
}

export async function action({ request }) {
  try {
    console.log("🔄 Configurator proxy POST:", request.url);

    // Simple redirect to main endpoint
    return json({
      success: false,
      error: "Use direct app endpoint instead",
      redirect: "/apps/custom-configurator/add-to-cart"
    }, { status: 302 });

  } catch (error) {
    console.error("❌ Proxy error:", error);
    return json({
      success: false,
      error: error.message || "Proxy error occurred"
    }, { status: 500 });
  }
}