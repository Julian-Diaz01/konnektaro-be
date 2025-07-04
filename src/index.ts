import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { connectDB } from './db';
import userRoutes from './routes/userRoutes'
import sessionRoutes from "./routes/sessionRoutes";
import activityRoutes from "./routes/activityRoutes";

const app = express()
const PORT = process.env.PORT || 3000
const API_KEY = process.env.API_KEY

app.use(cors())
app.use(bodyParser.json())

// Security middleware
app.use((req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization
    if (!auth || auth !== `Bearer ${API_KEY}`) {
        return res.status(403).json({ error: 'Unauthorized' })
    }
    next()
})

// Health check route
app.get('/', (req: Request, res: Response) => {
    res.send('API is running')
})
app.use('/user', userRoutes)
app.use('/session', sessionRoutes)
app.use('/activity', activityRoutes)

// Start the server
const start = async () => {
    await connectDB()
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`)
    })
}

start()
