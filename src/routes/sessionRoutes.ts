import { Router, Request, Response } from 'express'
import { getSessionCollection } from '../collections/sessionCollection'
import { getUserCollection } from '../collections/userCollection'
import { createSession } from '../models/session'
import {ActivityGroup} from "../models/activity";
import {User} from "../models/user";

const router = Router()
console.log("🐀 Initializing /session routes")

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
router.post('/:sessionId/pair-users/:activityId', async (req: Request, res: Response) => {
    const { sessionId, activityId } = req.params

    const userCollection = getUserCollection()
    const sessionCollection = getSessionCollection()

    const users = await userCollection.find({ sessionId }).toArray()
    const shuffled = users.sort(() => Math.random() - 0.5)

    let groupCounter = 1

    for (let i = 0; i < shuffled.length; i += 2) {
        const userA = shuffled[i]
        const userB = shuffled[i + 1]

        const updateUserGroup = async (user: User, partner?: User) => {
            const groupEntry: ActivityGroup = {
                activityId,
                group: groupCounter,
                partnerId: partner?.userId,
                partnerName: partner?.name
            }

            const updatedGroups = [
                ...(user.activities || []).filter(g => g.activityId !== activityId),
                groupEntry
            ]

            await userCollection.updateOne(
                { userId: user.userId },
                { $set: { groups: updatedGroups } }
            )
        }

        if (userB) {
            await updateUserGroup(userA, userB)
            await updateUserGroup(userB, userA)
        } else {
            await updateUserGroup(userA)
        }

        groupCounter++
    }

    // Update the session to include this activityId if not already present
    await sessionCollection.updateOne(
        { sessionId },
        { $addToSet: { activityIds: activityId } }
    )

    const updatedUsers = await userCollection.find({ sessionId }).toArray()
    res.json({ users: updatedUsers })
})

export default router
