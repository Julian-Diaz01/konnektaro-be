import {Router, Request, Response} from 'express'
import {createUserActivity} from '../models/userActivity'
import {verifyFirebaseToken} from '../middleware/authMiddleware'
import sanitizeHtml from 'sanitize-html'
import {getUserActivityCollection} from "../collections/userActivityCollection";
import {updateUserReview} from '../services/reviewService'
import {getUserCollection} from '../collections/userCollection'

const router = Router()
console.log('🐰 Initializing /user-activity routes')

// 🆕 Create UserActivity
router.post('/', verifyFirebaseToken, async (req: Request, res: Response) => {
    const {activityId, groupId, notes, userId} = req.body

    if (!activityId || !notes || !userId) {
        return res.status(400).json({error: 'Missing required fields'})
    }

    const collection = getUserActivityCollection()

    // Prevent multiple answers from same user for same activity
    const existing = await collection.findOne({activityId, userId})
    if (existing) {
        return res.status(409).json({error: 'User has already submitted a response for this activity'})
    }

    // Sanitize input to prevent script injection
    const cleanNotes = sanitizeHtml(notes, {
        allowedTags: [],
        allowedAttributes: {}
    })

    const userActivity = createUserActivity({
        activityId,
        groupId,
        notes: cleanNotes,
        date: new Date().toISOString(),
        userId
    })

    await collection.insertOne({...userActivity})

    // ✅ AUTO-GENERATE REVIEW after activity completion
    try {
        // Get the user to find the eventId
        const userCollection = getUserCollection()
        const user = await userCollection.findOne({ userId })
        
        if (user && user.eventId) {
            await updateUserReview(userId, user.eventId)
            console.log(`✅ Auto-generated review for user ${userId} in event ${user.eventId}`)
        }
    } catch (error) {
        console.error(`❌ Failed to auto-generate review:`, error)
        // Don't fail the main request if review generation fails
    }

    res.status(201).json(userActivity)
})

// 📄 Get all UserActivity (admin only)
router.get('/', verifyFirebaseToken, async (_req: Request, res: Response) => {
    const collection = getUserActivityCollection()
    const all = await collection.find({}).toArray()
    res.json(all)
})

// 🔍 Get UserActivity by userId & activityId
router.get('/user/:userId/activity/:activityId', verifyFirebaseToken, async (req: Request, res: Response) => {
    const {userId, activityId} = req.params
    const collection = getUserActivityCollection()
    const result = await collection.findOne({userId, activityId})

    if (!result) return res.status(404).json({error: 'Not found'})
    res.json(result)
})

// 📝 Update UserActivity (by user & activity)
router.put('/user/:userId/activity/:activityId', verifyFirebaseToken, async (req: Request, res: Response) => {
    const {userId, activityId} = req.params
    const {notes, groupId} = req.body

    if (!notes) return res.status(400).json({error: 'Missing notes'})

    const collection = getUserActivityCollection()

    const cleanNotes = sanitizeHtml(notes, {
        allowedTags: [],
        allowedAttributes: {}
    })

    const result = await collection.updateOne(
        {userId, activityId},
        {$set: {notes: cleanNotes, groupId: groupId, date: new Date().toISOString()}}
    )

    if (result.matchedCount === 0) return res.status(404).json({error: 'Not found'})

    // ✅ AUTO-UPDATE REVIEW after activity update
    try {
        // Get the user to find the eventId
        const userCollection = getUserCollection()
        const user = await userCollection.findOne({ userId })
        
        if (user && user.eventId) {
            await updateUserReview(userId, user.eventId)
            console.log(`✅ Auto-updated review for user ${userId} in event ${user.eventId}`)
        }
    } catch (error) {
        console.error(`❌ Failed to auto-update review:`, error)
        // Don't fail the main request if review generation fails
    }

    res.json({message: 'UserActivity updated'})
})

// ❌ Delete UserActivity (by user & activity)
router.delete('/user/:userId/activity/:activityId', verifyFirebaseToken, async (req: Request, res: Response) => {
    const {userId, activityId} = req.params
    const collection = getUserActivityCollection()

    const result = await collection.deleteOne({userId, activityId})

    if (result.deletedCount === 0) return res.status(404).json({error: 'Not found'})

    // ✅ AUTO-UPDATE REVIEW after activity deletion
    try {
        // Get the user to find the eventId
        const userCollection = getUserCollection()
        const user = await userCollection.findOne({ userId })
        
        if (user && user.eventId) {
            await updateUserReview(userId, user.eventId)
            console.log(`✅ Auto-updated review for user ${userId} in event ${user.eventId} after deletion`)
        }
    } catch (error) {
        console.error(`❌ Failed to auto-update review after deletion:`, error)
        // Don't fail the main request if review generation fails
    }

    res.json({message: 'UserActivity deleted'})
})

export default router
