import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'

const app = initializeApp({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: 'konnektar-5e73f.firebaseapp.com',
    projectId: 'konnektar-5e73f',
})

const auth = getAuth(app)

signInAnonymously(auth).then(result =>
    result.user.getIdToken().then(token => console.log(token))
)