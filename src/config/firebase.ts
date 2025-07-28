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

const deleteAnonymousUsers = async () => {
    getAuth().listUsers(20)
        .then(function (listUsersResult) {
            listUsersResult.users.forEach(function (userRecord) {
                if (userRecord.providerData.length === 0) { //this user is anonymous
                    console.log(userRecord)
                    getAuth().deleteUser(userRecord.uid).then(function () {
                        console.log("Successfully deleted user");
                    })
                        .catch(function (error) {
                            console.log("Error deleting user:", error);
                        });
                }
            });
        })
        .catch(function (error) {
            console.log('Error listing users:', error);
        });
}