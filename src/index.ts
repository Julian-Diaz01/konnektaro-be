import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { connectDB } from './db';
import userRoutes from './routes/userRoutes'
import eventRoutes from "./routes/eventRoutes";
import activityRoutes from "./routes/activityRoutes";
import participantRoutes from "./routes/participantRoutes";
import userActivityRoutes from "./routes/userActivityRoutes";

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(bodyParser.json())

// Health check route
app.get('/', (req: Request, res: Response) => {
    res.send('API is running')
})

app.get('/api/firebase-key', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
    });
});

app.use('/user', userRoutes)
app.use('/event', eventRoutes)
app.use('/events', participantRoutes)
app.use('/activity', activityRoutes)
app.use('/user-activity', userActivityRoutes)

// Start the server
const start = async () => {
    await connectDB()
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`)
    })
}

start()
