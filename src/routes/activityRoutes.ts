import { Router, Request, Response } from 'express'
import { getActivityCollection } from '../collections/activityCollection'
import { getSessionCollection } from '../collections/sessionCollection'
import { createActivity } from '../models/activity'
import { verifyFirebaseToken } from '../middleware/authMiddleware'

const router = Router()
console.log('🐈 Initializing /activity routes')

// Create Activity
router.post('/', verifyFirebaseToken, async (req: Request, res: Response) => {
    const { type, question, title, sessionId } = req.body

    if (!type || !question || !title || !sessionId) {
        return res.status(400).json({ error: 'Missing required fields' })
    }

    const sessionCollection = getSessionCollection()
    const session = await sessionCollection.findOne({ sessionId })

    if (!session || !session.open) {
        return res.status(400).json({ error: 'Session not found or not open' })
    }

    const activity = createActivity({
        sessionId,
        type,
        question,
        title,
        date: new Date().toISOString()
    })

    const collection = getActivityCollection()
    await collection.insertOne(activity)
    res.status(201).json(activity)
})

// Get All Activities
router.get('/', verifyFirebaseToken, async (_req: Request, res: Response) => {
    const collection = getActivityCollection()
    const activities = await collection.find({}).toArray()
    res.json(activities)
})

// Get Activity by ID
router.get('/:activityId', verifyFirebaseToken, async (req: Request, res: Response) => {
    const { activityId } = req.params
    const collection = getActivityCollection()
    const activity = await collection.findOne({ activityId })

    if (!activity) return res.status(404).json({ error: 'Activity not found' })

    res.json(activity)
})

// Delete Activity
router.delete('/:activityId', verifyFirebaseToken, async (req: Request, res: Response) => {
    const { activityId } = req.params
    const collection = getActivityCollection()
    const result = await collection.deleteOne({ activityId })

    if (result.deletedCount === 0) return res.status(404).json({ error: 'Activity not found' })

    res.json({ message: 'Activity deleted' })
})

export default router
