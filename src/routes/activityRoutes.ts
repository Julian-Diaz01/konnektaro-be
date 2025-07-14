import {Router, Request, Response} from 'express'
import {getActivityCollection} from '../collections/activityCollection'
import {createActivity} from '../models/activity'
import {verifyFirebaseToken} from "../middleware/authMiddleware";

const router = Router()
console.log("🐈 Initializing /activity routes")

// Create Activity
router.post('/', async (req: Request, res: Response) => {

    if (!req.body.type || !req.body.question) {
        return res.status(400).json({error: 'Missing required fields'})
    }

    const activity = createActivity(req.body)

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
    const {activityId} = req.params
    const collection = getActivityCollection()
    const activity = await collection.findOne({activityId})

    if (!activity) return res.status(404).json({error: 'Activity not found'})

    res.json(activity)
})

// Delete Activity
router.delete('/:activityId', verifyFirebaseToken, async (req: Request, res: Response) => {
    const {activityId} = req.params
    const collection = getActivityCollection()
    const result = await collection.deleteOne({activityId})

    if (result.deletedCount === 0) return res.status(404).json({error: 'Activity not found'})

    res.json({message: 'Activity deleted'})
})

export default router
