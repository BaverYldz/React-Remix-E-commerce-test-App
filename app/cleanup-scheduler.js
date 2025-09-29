// Task 12: Cleanup Scheduler - Ana app'te başlatılacak
import { authenticate } from "./shopify.server";
import { startCleanupScheduler } from "./cleanup-system.js";

// Global cleanup interval reference
let cleanupInterval = null;

export async function initializeCleanupSystem() {
    try {
        console.log('🚀 Initializing cleanup system...');
        
        // Eğer zaten çalışıyorsa durdur
        if (cleanupInterval) {
            clearInterval(cleanupInterval);
        }
        
        // Shopify admin instance oluştur (session'sız global için)
        // Not: Bu gerçek uygulamada session management gerektirir
        console.log('⚙️ Cleanup system will start when first user authenticates');
        
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize cleanup system:', error);
        return false;
    }
}

// Session ile cleanup başlat (kullanıcı login olduğunda)
export async function startUserCleanup(admin) {
    try {
        if (cleanupInterval) {
            console.log('⚠️ Cleanup already running, skipping...');
            return true;
        }
        
        console.log('🎯 Starting cleanup scheduler with authenticated admin...');
        cleanupInterval = startCleanupScheduler(admin, 5); // Her 5 dakikada bir
        
        console.log('✅ Cleanup system started successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to start cleanup system:', error);
        return false;
    }
}

// Manuel cleanup trigger (test için)
export async function triggerManualCleanup(admin) {
    const { TemporaryProductCleanup } = await import('./cleanup-system.js');
    const cleanup = new TemporaryProductCleanup(admin);
    
    console.log('🧹 Manual cleanup triggered...');
    const result = await cleanup.runCleanup();
    
    return result;
}