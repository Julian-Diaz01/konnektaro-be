// index.ts
import dotenv from 'dotenv'
dotenv.config()

import express, { Request, Response } from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import { createServer } from 'http'
import { connectDB } from './db'
import userRoutes from './routes/userRoutes'
import eventRoutes from './routes/eventRoutes'
import activityRoutes from './routes/activityRoutes'
import participantRoutes from './routes/participantRoutes'
import userActivityRoutes from './routes/userActivityRoutes'
import { setupSocket, getSocketServer } from './socket'

const app = express()
const PORT = process.env.PORT || 8080

// Configure CORS to be more permissive for WebSocket connections
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(bodyParser.json())

app.get('/', (req: Request, res: Response) => {
    res.send('API is running')
})

app.get('/api/firebase-key', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
    })
})

// Test endpoint to verify WebSocket server is running
app.get('/api/socket-status', (req, res) => {
    try {
        const io = getSocketServer()
        const connectedClients = io.engine.clientsCount
        res.json({
            status: 'running',
            connectedClients,
            message: 'WebSocket server is active'
        })
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'WebSocket server not initialized'
        })
    }
})

app.use('/user', userRoutes)
app.use('/event', eventRoutes)
app.use('/events', participantRoutes)
app.use('/activity', activityRoutes)
app.use('/user-activity', userActivityRoutes)

const start = async () => {
    await connectDB()

    const server = createServer(app)
    setupSocket(server) // ✅ PASS SERVER HERE

    server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`)
        console.log(`🔌 WebSocket server available at ws://localhost:${PORT}`)
    })
}

start()
