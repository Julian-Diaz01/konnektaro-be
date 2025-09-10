import {Router, Request, Response} from 'express'
import {createUserActivity} from '../models/userActivity'
import {verifyFirebaseToken} from '../middleware/authMiddleware'
import sanitizeHtml from 'sanitize-html'
import {getUserActivityCollection} from "../collections/userActivityCollection";
import {updateUserReview} from '../services/reviewService'
import {getUserCollection} from '../collections/userCollection'
import {emitPartnerNoteUpdated} from '../sockets/partnerNoteSockets'

const router = Router()
console.log('🐰 Initializing /user-activity routes')

// 🆕 Create UserActivity
router.post('/', verifyFirebaseToken, async (req: Request, res: Response) => {
    const {activityId, groupId, notes, userId} = req.body
    const requesterUid = req.user?.uid

    if (!activityId || !notes || !userId) {
        return res.status(400).json({error: 'Missing required fields'})
    }
    
    // Size limit for notes (10KB)
    if (notes.length > 10000) {
        return res.status(400).json({error: 'Notes too long - maximum 10,000 characters'})
    }
    
    // Verify the requester is creating notes for themselves
    if (requesterUid !== userId) {
        return res.status(403).json({error: 'Can only create notes for yourself'})
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

    const insertResult = await collection.insertOne({...userActivity})
    console.log(`✅ UserActivity created: ${insertResult.insertedId} for user ${userId}, activity ${activityId}`)

    // Verify the insert was successful by reading it back immediately
    const insertedActivity = await collection.findOne({_id: insertResult.insertedId})
    if (!insertedActivity) {
        console.error(`❌ CRITICAL: UserActivity insert verification failed for ${insertResult.insertedId}`)
        return res.status(500).json({error: 'Failed to create user activity'})
    }

    // ✅ AUTO-GENERATE REVIEW after activity completion (async, non-blocking)
    setImmediate(async () => {
        try {
            // Get the user to find the eventId
            const userCollection = getUserCollection()
            const user = await userCollection.findOne({ userId })
            
            if (user && user.eventId) {
                await updateUserReview(userId, user.eventId)
                console.log(`✅ Auto-generated review for user ${userId} in event ${user.eventId}`)
                
                // 📡 Emit partner note updated event (using the actual userId, not Firebase UID)
                emitPartnerNoteUpdated(user.eventId, activityId, userId, cleanNotes)
            }
        } catch (error) {
            console.error(`❌ Failed to auto-generate review:`, error)
            // Don't fail the main request if review generation fails
        }
    })

    res.status(201).json(insertedActivity)
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
    const requesterUid = req.user?.uid
    
    if (!requesterUid) {
        return res.status(401).json({error: 'Authentication required'})
    }

    // Get the requester's user info to verify they belong to the same event
    const userCollection = getUserCollection()
    const requesterUser = await userCollection.findOne({ userId: requesterUid })
    
    if (!requesterUser) {
        return res.status(404).json({error: 'Requester user not found'})
    }

    const collection = getUserActivityCollection()
    const result = await collection.findOne({userId, activityId})

    if (!result) return res.status(404).json({error: 'Not found'})
    
    // Verify the target user belongs to the same event as the requester
    const targetUser = await userCollection.findOne({ userId })
    if (!targetUser || targetUser.eventId !== requesterUser.eventId) {
        return res.status(403).json({error: 'Access denied - users must be in the same event'})
    }
    
    res.json(result)
})

// 📝 Update UserActivity (by user & activity)
router.put('/user/:userId/activity/:activityId', verifyFirebaseToken, async (req: Request, res: Response) => {
    const {userId, activityId} = req.params
    const {notes, groupId} = req.body
    const requesterUid = req.user?.uid

    if (!notes) return res.status(400).json({error: 'Missing notes'})
    
    // Size limit for notes (10KB)
    if (notes.length > 10000) {
        return res.status(400).json({error: 'Notes too long - maximum 10,000 characters'})
    }
    
    // Verify the requester is updating their own notes
    if (requesterUid !== userId) {
        return res.status(403).json({error: 'Can only update your own notes'})
    }

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
    
    console.log(`✅ UserActivity updated: ${result.modifiedCount} documents modified for user ${userId}, activity ${activityId}`)

    // ✅ AUTO-UPDATE REVIEW after activity update (async, non-blocking)
    setImmediate(async () => {
        try {
            // Get the user to find the eventId
            const userCollection = getUserCollection()
            const user = await userCollection.findOne({ userId })
            
            if (user && user.eventId) {
                await updateUserReview(userId, user.eventId)
                console.log(`✅ Auto-updated review for user ${userId} in event ${user.eventId}`)
                
                // 📡 Emit partner note updated event (using the actual userId, not Firebase UID)
                emitPartnerNoteUpdated(user.eventId, activityId, userId, cleanNotes)
            }
        } catch (error) {
            console.error(`❌ Failed to auto-update review:`, error)
            // Don't fail the main request if review generation fails
        }
    })

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
