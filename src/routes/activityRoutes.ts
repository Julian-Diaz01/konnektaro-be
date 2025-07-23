import { Router, Request, Response } from 'express'
import { getActivityCollection } from '../collections/activityCollection'
import { getEventCollection } from '../collections/eventCollection'
import { createActivity } from '../models/activity'
import { verifyFirebaseToken } from '../middleware/authMiddleware'

const router = Router()
console.log('🐈 Initializing /activity routes')

// Create Activity
router.post('/', verifyFirebaseToken, async (req: Request, res: Response) => {
    const { type, question, title, eventId } = req.body

    if (!type || !question || !title || !eventId) {
        return res.status(400).json({ error: 'Missing required fields' })
    }

    const eventCollection = getEventCollection()
    const event = await eventCollection.findOne({ eventId })

    if (!event || !event.open) {
        return res.status(400).json({ error: 'Event not found or not open' })
    }

    const activity = createActivity({
        eventId,
        type,
        question,
        title,
        date: new Date().toISOString()
    })

    const collection = getActivityCollection()
    await collection.insertOne(activity)

    // ✅ Update the event to include the new activityId
    await eventCollection.updateOne(
        { eventId },
        { $addToSet: { activityIds: activity.activityId } }
    )

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
    const activityCollection = getActivityCollection()
    const eventCollection = getEventCollection()

    // 1. Find the activity first to get the eventId
    const activity = await activityCollection.findOne({ activityId })

    if (!activity) {
        return res.status(404).json({ error: 'Activity not found' })
    }

    // 2. Delete the activity
    const result = await activityCollection.deleteOne({ activityId })

    if (result.deletedCount === 0) {
        return res.status(500).json({ error: 'Failed to delete activity' })
    }

    // 3. Update the event to remove the activityId
    await eventCollection.updateOne(
        { eventId: activity.eventId },
        { $pull: { activityIds: activityId } }
    )

    return res.json({ message: 'Activity deleted and event updated' })
})


export default router
