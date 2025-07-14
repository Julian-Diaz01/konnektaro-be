import { Router, Request, Response } from 'express'
import { getSessionCollection } from '../collections/sessionCollection'
import { getUserCollection } from '../collections/userCollection'
import { createSession } from '../models/session'
import { ParticipantUser } from '../models/user'
import { verifyFirebaseToken } from '../middleware/authMiddleware'
import { ActivityGroupItem, createGroupActivity } from '../models/groupActivity'
import { v4 as uuidv4 } from 'uuid'
import { getGroupActivityCollection } from '../collections/getGroupActivityCollection'

const router = Router()
console.log('🐀 Initializing /session routes')

// 🔐 Helper: Check if the user is admin
const isAdmin = (req: Request): boolean => {
    const role = req.headers['x-user-role'] || req.body?.role
    return role === 'admin'
}

// Create Session (admin only)
router.post('/', verifyFirebaseToken, async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
        return res.status(403).json({ error: 'Only admins can create sessions' })
    }

    const { name, description, picture, activityIds } = req.body

    if (!name || !description || !Array.isArray(activityIds)) {
        return res.status(400).json({ error: 'Missing required fields' })
    }

    const session = createSession({
        name,
        description,
        picture,
        activityIds,
        open: false,
        participantIds: []
    })

    const collection = getSessionCollection()
    await collection.insertOne(session)

    res.status(201).json(session)
})

// Get session by ID (admin only)
router.get('/:sessionId', verifyFirebaseToken, async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
        return res.status(403).json({ error: 'Only admins can view sessions' })
    }

    const { sessionId } = req.params
    const collection = getSessionCollection()
    const session = await collection.findOne({ sessionId })

    if (!session) return res.status(404).json({ error: 'Session not found' })

    res.json(session)
})

// List all sessions (admin only)
router.get('/', verifyFirebaseToken, async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
        return res.status(403).json({ error: 'Only admins can list sessions' })
    }

    const collection = getSessionCollection()
    const sessions = await collection.find({}).toArray()
    res.json(sessions)
})

// Delete session (admin only)
router.delete('/:sessionId', verifyFirebaseToken, async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
        return res.status(403).json({ error: 'Only admins can delete sessions' })
    }

    const { sessionId } = req.params
    const collection = getSessionCollection()
    await collection.deleteOne({ sessionId })
    res.json({ message: 'Session deleted' })
})

// Remove user from session (admin only)
router.post('/:sessionId/remove-user/:userId', verifyFirebaseToken, async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
        return res.status(403).json({ error: 'Only admins can remove users' })
    }

    const { sessionId, userId } = req.params
    const userCollection = getUserCollection()
    const sessionCollection = getSessionCollection()

    await userCollection.deleteOne({ userId, sessionId })
    await sessionCollection.updateOne(
        { sessionId },
        { $pull: { participantIds: userId } }
    )

    res.json({ message: 'User removed from session' })
})

// Get all users in a session
router.get('/:sessionId/users', verifyFirebaseToken, async (req: Request, res: Response) => {
    const { sessionId } = req.params
    const collection = getUserCollection()

    const users = await collection.find({ sessionId }).toArray()
    res.json(users)
})

// Pair Users into GroupActivity
router.post(
    '/:sessionId/activity-group/:activityId',
    verifyFirebaseToken,
    async (req: Request, res: Response) => {
        try {
            const { sessionId, activityId } = req.params

            const userCollection = getUserCollection()
            const sessionCollection = getSessionCollection()
            const groupCollection = getGroupActivityCollection()

            // Remove previous groups for this activity if re-triggered
            await groupCollection.deleteMany({ activityId })

            const users = await userCollection
                .find({ sessionId }, { projection: { userId: 1, name: 1, icon: 1 } })
                .toArray()

            if (users.length === 0) {
                return res.status(404).json({ message: 'No users found for this session' })
            }

            const shuffled = [...users].sort(() => Math.random() - 0.5)
            const groupColors = ['red', 'blue', 'green', 'yellow']
            const groups: ActivityGroupItem[] = []
            let groupNumber = 1

            for (let i = 0; i < shuffled.length; i += 2) {
                const userA = shuffled[i]
                const userB = shuffled[i + 1]

                const participants: ParticipantUser[] = [
                    { userId: userA.userId, name: userA.name, icon: userA.icon }
                ]

                if (userB) {
                    participants.push({
                        userId: userB.userId,
                        name: userB.name,
                        icon: userB.icon
                    })
                }

                const groupColor = groupColors[(groupNumber - 1) % groupColors.length]

                groups.push({
                    groupId: uuidv4(),
                    groupNumber,
                    groupColor,
                    participants
                })

                groupNumber++
            }

            const groupActivity = createGroupActivity({
                activityId,
                groups,
                active: true
            })

            await groupCollection.insertOne(groupActivity)

            await sessionCollection.updateOne(
                { sessionId },
                { $addToSet: { activityIds: activityId } }
            )

            res.status(201).json(groupActivity)
        } catch (error) {
            console.error('Error creating group activity:', error)
            res.status(500).json({ message: 'Internal server error' })
        }
    }
)

export default router
