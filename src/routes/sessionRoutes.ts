import { Router, Request, Response } from 'express'
import { getSessionCollection } from '../collections/sessionCollection'
import { getUserCollection } from '../collections/userCollection'
import { createSession } from '../models/session'

const router = Router()

// 🔐 Helper: Check if the user is admin
const isAdmin = (req: Request): boolean => {
    const role = req.headers['x-user-role'] || req.body?.role
    return role === 'admin'
}

// Create Session (admin only)
router.post('/', async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
        return res.status(403).json({ error: 'Only admins can create sessions' })
    }

    const { name, description, picture, activityIds } = req.body

    if (!name || !description || !Array.isArray(activityIds)) {
        return res.status(400).json({ error: 'Missing required fields' })
    }

    const session = createSession({ name, description, picture, activityIds })
    const collection = getSessionCollection()
    await collection.insertOne(session)

    res.status(201).json(session)
})

// Get session by ID
router.get('/:sessionId', async (req: Request, res: Response) => {
    const { sessionId } = req.params
    const collection = getSessionCollection()
    const session = await collection.findOne({ sessionId })

    if (!session) return res.status(404).json({ error: 'Session not found' })

    res.json(session)
})

// List all sessions
router.get('/', async (_req: Request, res: Response) => {
    const collection = getSessionCollection()
    const sessions = await collection.find({}).toArray()
    res.json(sessions)
})

// Get all users in a session
router.get('/:sessionId/users', async (req: Request, res: Response) => {
    const { sessionId } = req.params
    const collection = getUserCollection()

    const users = await collection.find({ sessionId }).toArray()
    res.json(users)
})

// Pair Users
router.post('/:sessionId/pair-users', async (req: Request, res: Response) => {
    const { sessionId } = req.params
    const collection = getUserCollection()

    const users = await collection.find({ sessionId }).toArray()
    const shuffled = users.sort(() => Math.random() - 0.5)

    let groupCounter = 1

    for (let i = 0; i < shuffled.length; i += 2) {
        const userA = shuffled[i]
        const userB = shuffled[i + 1]

        if (userB) {
            await collection.updateOne(
                { userId: userA.userId },
                { $set: { group: groupCounter, partnerId: userB.userId } }
            )
            await collection.updateOne(
                { userId: userB.userId },
                { $set: { group: groupCounter, partnerId: userA.userId } }
            )
        } else {
            await collection.updateOne(
                { userId: userA.userId },
                { $set: { group: groupCounter, partnerId: undefined } }
            )
        }

        groupCounter++
    }

    const updatedUsers = await collection.find({ sessionId }).toArray()
    res.json({ users: updatedUsers })
})

export default router
