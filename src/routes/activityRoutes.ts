import { Router, Request, Response } from 'express'
import { getActivityCollection } from '../collections/activityCollection'
import { Activity } from '../models/activity'

const router = Router()

// Create Activity
router.post('/', async (req: Request, res: Response) => {
    const { activityId, type, question, notePlaceholder, saveEnabled } = req.body

    if (!activityId || !type || !question) {
        return res.status(400).json({ error: 'Missing required fields' })
    }

    const collection = getActivityCollection()
    const existing = await collection.findOne({ activityId })
    if (existing) return res.status(409).json({ error: 'Activity already exists' })

    const activity: Activity = {
        activityId,
        type,
        question,
        notePlaceholder: notePlaceholder || '',
        saveEnabled: saveEnabled ?? true,
    }

    await collection.insertOne(activity)
    res.status(201).json(activity)
})

// Get All Activities
router.get('/', async (_req: Request, res: Response) => {
    const collection = getActivityCollection()
    const activities = await collection.find({}).toArray()
    res.json(activities)
})

// Get Activity by ID
router.get('/:activityId', async (req: Request, res: Response) => {
    const { activityId } = req.params
    const collection = getActivityCollection()
    const activity = await collection.findOne({ activityId })

    if (!activity) return res.status(404).json({ error: 'Activity not found' })

    res.json(activity)
})

// Delete Activity
router.delete('/:activityId', async (req: Request, res: Response) => {
    const { activityId } = req.params
    const collection = getActivityCollection()
    const result = await collection.deleteOne({ activityId })

    if (result.deletedCount === 0) return res.status(404).json({ error: 'Activity not found' })

    res.json({ message: 'Activity deleted' })
})

export default router
