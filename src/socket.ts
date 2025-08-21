// socket.ts
import {Server} from 'socket.io'
import type {Server as HttpServer} from 'http'

let io: Server

export function setupSocket(server: HttpServer) {
    io = new Server(server, {
        cors: {
            origin: [process.env.FRONTEND_URL as string, process.env.FRONTEND_URL2 as string],
            methods: ["PATCH"],
            credentials: true,
            allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        pingTimeout: 60000,
        pingInterval: 25000,
        upgradeTimeout: 10000,
        maxHttpBufferSize: 1e6
    })

    console.log('🦊 Socket.IO initialized')

    io.on('connection', (socket) => {
        console.log('User connected:', socket.id)

        socket.on('joinEvent', (eventId) => {
            socket.join(eventId)
            console.log(`User ${socket.id} joined event ${eventId}`)
        })

        socket.on('disconnect', (reason) => {
            console.log('User disconnected:', socket.id, 'Reason:', reason)
        })

        socket.on('error', (error) => {
            console.error('Socket error:', error)
        })
    })

    io.engine.on('connection_error', (err) => {
        console.error('Connection error:', err)
    })

    // Handle upgrade errors
    io.engine.on('upgrade_error', (err) => {
        console.error('Upgrade error:', err)
    })
}

export function getSocketServer() {
    if (!io) {
        throw new Error('Socket.IO server not initialized. Call setupSocket() first.')
    }
    return io
}
