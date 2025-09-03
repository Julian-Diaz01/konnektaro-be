import admin from "firebase-admin";
import serviceAccount from "../../serviceAccountKey.json";
import {getAuth} from "firebase-admin/auth";


if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
    })
    console.log('✅ Firebase Admin initialized successfully')
} else {
    console.warn('⚠️ Firebase Admin was already initialized or failed to initialize')
}
export default admin

// Track if the scheduled task is already running
let isScheduledTaskRunning = false;
let scheduledTaskInterval: NodeJS.Timeout | null = null;

const deleteAnonymousUsers = async () => {
    try {
        console.log('🔄 Starting anonymous user cleanup...');
        
        // Get current timestamp (24 hours ago)
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
        
        // List all users (Firebase Admin SDK handles pagination automatically)
        const listUsersResult = await getAuth().listUsers();
        
        let deletedCount = 0;
        let errorCount = 0;
        
        for (const userRecord of listUsersResult.users) {
            // Check if user is anonymous (no provider data) and created more than 24 hours ago
            if (userRecord.providerData.length === 0 && userRecord.metadata.creationTime) {
                const creationTime = new Date(userRecord.metadata.creationTime).getTime();
                
                if (creationTime < twentyFourHoursAgo) {
                    try {
                        await getAuth().deleteUser(userRecord.uid);
                        console.log(`✅ Successfully deleted anonymous user: ${userRecord.uid}`);
                        deletedCount++;
                    } catch (error) {
                        console.error(`❌ Error deleting user ${userRecord.uid}:`, error);
                        errorCount++;
                    }
                }
            }
        }
        
        console.log(`🎯 Anonymous user cleanup completed. Deleted: ${deletedCount}, Errors: ${errorCount}`);
        return { deletedCount, errorCount };
        
    } catch (error) {
        console.error('❌ Error during anonymous user cleanup:', error);
        throw error;
    }
}

// Schedule the cleanup task to run every 24 hours
const scheduleAnonymousUserCleanup = () => {
    if (scheduledTaskInterval) {
        console.log('⚠️ Anonymous user cleanup task is already scheduled');
        return;
    }
    
    console.log('⏰ Scheduling anonymous user cleanup task (every 24 hours)...');
    
    // Run immediately on startup
    deleteAnonymousUsers().catch(error => {
        console.error('❌ Initial anonymous user cleanup failed:', error);
    });
    
    // Schedule to run every 24 hours (24 * 60 * 60 * 1000 milliseconds)
    scheduledTaskInterval = setInterval(async () => {
        if (isScheduledTaskRunning) {
            console.log('⚠️ Previous cleanup task still running, skipping this iteration');
            return;
        }
        
        isScheduledTaskRunning = true;
        
        try {
            await deleteAnonymousUsers();
        } catch (error) {
            console.error('❌ Scheduled anonymous user cleanup failed:', error);
        } finally {
            isScheduledTaskRunning = false;
        }
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    console.log('✅ Anonymous user cleanup task scheduled successfully');
}

// Function to stop the scheduled task (useful for testing or graceful shutdown)
const stopAnonymousUserCleanup = () => {
    if (scheduledTaskInterval) {
        clearInterval(scheduledTaskInterval);
        scheduledTaskInterval = null;
        isScheduledTaskRunning = false;
        console.log('🛑 Anonymous user cleanup task stopped');
    }
}

export { deleteAnonymousUsers, scheduleAnonymousUserCleanup, stopAnonymousUserCleanup };