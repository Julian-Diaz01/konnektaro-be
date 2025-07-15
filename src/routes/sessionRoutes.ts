import {Router, Request, Response} from 'express'
import {getSessionCollection} from '../collections/sessionCollection'
import {getUserCollection} from '../collections/userCollection'
import {createSession} from '../models/session'
import {ParticipantUser} from '../models/user'
import {verifyFirebaseToken} from '../middleware/authMiddleware'
import {ActivityGroupItem, createGroupActivity} from '../models/groupActivity'
import {v4 as uuidv4} from 'uuid'
import {getGroupActivityCollection} from '../collections/getGroupActivityCollection'
import {chunk} from 'lodash'

const router = Router()
console.log('🐀 Initializing /session routes')

// 🔐 Helper: Check if the user is admin
const isAdmin = (req: Request): boolean => {
    const role = req.headers['x-user-role'] || req.body?.role
    return true ///TODO: Implement actual admin check logic
}

// Create Session (admin only)
router.post('/', verifyFirebaseToken, async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
        return res.status(403).json({error: 'Only admins can create sessions'})
    }

    const {name, description, picture, activityIds, open} = req.body

    if (!name || !description || !Array.isArray(activityIds)) {
        return res.status(400).json({error: 'Missing required fields'})
    }

    const session = createSession({
        name,
        description,
        picture,
        activityIds,
        open,
        participantIds: []
    })

    const collection = getSessionCollection()
    await collection.insertOne(session)

    res.status(201).json(session)
})

// Get session by ID (admin only)
router.get('/:sessionId', verifyFirebaseToken, async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
        return res.status(403).json({error: 'Only admins can view sessions'})
    }

    const {sessionId} = req.params
    const collection = getSessionCollection()
    const session = await collection.findOne({sessionId})

    if (!session) return res.status(404).json({error: 'Session not found'})

    res.json(session)
})

// List all sessions (admin only)
router.get('/', verifyFirebaseToken, async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
        return res.status(403).json({error: 'Only admins can list sessions'})
    }

    const collection = getSessionCollection()
    const sessions = await collection.find({}).toArray()
    res.json(sessions)
})

// Delete session (admin only)
router.delete('/:sessionId', verifyFirebaseToken, async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
        return res.status(403).json({error: 'Only admins can delete sessions'})
    }

    const {sessionId} = req.params
    const collection = getSessionCollection()
    await collection.deleteOne({sessionId})
    res.json({message: 'Session deleted'})
})

// Pair Users into GroupActivity
router.post(
    '/:sessionId/activity-group/:activityId',
    verifyFirebaseToken,
    async (req: Request, res: Response) => {
        try {
            const {sessionId, activityId} = req.params

            const userCollection = getUserCollection()
            const sessionCollection = getSessionCollection()
            const groupCollection = getGroupActivityCollection()

            // Remove previous groups for this activity if re-triggered
            await groupCollection.deleteMany({activityId})

            const users = await userCollection
                .find({sessionId}, {projection: {userId: 1, name: 1, icon: 1, description: 1}})
                .toArray()

            if (users.length === 0) {
                return res.status(404).json({message: 'No users found for this session'})
            }

            const shuffled = [...users].sort(() => Math.random() - 0.5)
            const groupColors = ['red', 'blue', 'green', 'yellow']
            const groups: ActivityGroupItem[] = []

            const pairs = chunk(shuffled, 2)

            pairs.forEach((pair: any[], index: number) => {
                const participants: ParticipantUser[] = pair.map(user => ({
                    userId: user.userId,
                    name: user.name,
                    icon: user.icon,
                    description: user.description
                }))

                const groupColor = groupColors[index % groupColors.length]

                groups.push({
                    groupId: uuidv4(),
                    groupNumber: index + 1,
                    groupColor,
                    participants
                })
            })

            const groupActivity = createGroupActivity({
                activityId,
                groups,
                active: true,
                share: req.body?.share ?? false
            })

            await groupCollection.insertOne(groupActivity)

            await sessionCollection.updateOne(
                {sessionId},
                {$addToSet: {activityIds: activityId}}
            )

            res.status(201).json(groupActivity)
        } catch (error) {
            console.error('Error creating group activity:', error)
            res.status(500).json({message: 'Internal server error'})
        }
    }
)

export default router
