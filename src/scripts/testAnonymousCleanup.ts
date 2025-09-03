import { deleteAnonymousUsers } from '../config/firebase';

// Test script to manually trigger anonymous user cleanup
const testCleanup = async () => {
    console.log('🧪 Testing anonymous user cleanup...');
    
    try {
        const result = await deleteAnonymousUsers();
        console.log('✅ Test completed successfully:', result);
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
    
    process.exit(0);
};

testCleanup();
