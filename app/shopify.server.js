import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

// Cleanup sistemi başlatma
let cleanupSystemInitialized = false;

export async function initializeCleanupSystem(admin) {
  if (cleanupSystemInitialized) {
    console.log('Cleanup system already initialized');
    return;
  }

  try {
    console.log('Initializing cleanup system...');

    // Dinamik import kullan
    const { startCleanupScheduler } = await import('./cleanup-system');

    // 5 dakikada bir cleanup çalıştır
    const cleanupInterval = startCleanupScheduler(admin, 5);

    // Cleanup sistemi başlatıldığını işaretle
    cleanupSystemInitialized = true;

    console.log('Cleanup system initialized successfully');

    // Graceful shutdown için cleanup
    process.on('SIGTERM', () => {
      console.log('🛑 Stopping cleanup system...');
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
      }
    });

    return true;
  } catch (error) {
    console.error('Failed to initialize cleanup system:', error);
    return false;
  }
}
