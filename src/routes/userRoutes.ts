import {Request, Response, Router} from 'express'
import {getUserCollection} from '../collections/userCollection'
import {createUser, User} from '../models/user'
import {verifyFirebaseToken} from "../middleware/authMiddleware";
import {getEventCollection} from "../collections/eventCollection";
import {getEventParticipantsCollection} from "../collections/eventParticipantsCollection";
import {getReviewCollection} from "../collections/reviewCollection";
import {updateUserReview} from '../services/reviewService'

const router = Router()
console.log("🐱 Initializing /user routes")

// Create User
router.post('/', verifyFirebaseToken, async (req: Request, res: Response) => {
    const {eventId, name, email, icon, description, role, userId} = req.body

    if (!eventId || !name || !icon || !description || !role || !userId) {
        return res.status(400).json({error: 'Missing required fields'})
    }

    const eventCollection = getEventCollection()
    const event = await eventCollection.findOne({eventId: eventId, open: true})
    if (!event) {
        return res.status(400).json({error: 'Event not found or not open'})
    }

    const user = createUser({
        userId,
        eventId,
        name,
        email,
        icon,
        description,
        role,
        userActivityIds: []
    })

    // ✅ Create the user
    const collection = getUserCollection()
    await collection.insertOne(user)

    // ✅ Register user in eventParticipants
    const eventParticipantCollection = getEventParticipantsCollection()
    await eventParticipantCollection.insertOne({
        eventId,
        userId: user.userId
    })
    // ✅ Also update the event's participantIds array
    await eventCollection.updateOne(
        {eventId},
        {$addToSet: {participantIds: user.userId}}
    )

    res.status(201).json(user)
})

// Read User
router.get('/:userId', verifyFirebaseToken, async (req: Request, res: Response) => {
    const {userId} = req.params
    const collection = getUserCollection()
    const user = await collection.findOne({userId})

    if (!user) return res.status(404).json({error: 'User not found'})

    res.json(user)
})

// Update User
router.put('/:userId', verifyFirebaseToken, async (req: Request, res: Response) => {
    const {userId} = req.params
    const {name, icon, description} = req.body

    const collection = getUserCollection()
    const updatedUser: User | null = await collection.findOneAndUpdate(
        {userId},
        {$set: {name, icon, description}},
        {returnDocument: 'after'}
    )

    if (!updatedUser) return res.status(404).json({error: 'User not found'})

    res.json(updatedUser)
})

// Delete User
router.delete('/:userId', verifyFirebaseToken, async (req: Request, res: Response) => {
    const {userId} = req.params

    const userCollection = getUserCollection()
    const participantCollection = getEventParticipantsCollection()
    const eventCollection = getEventCollection()

    // ✅ Get user to determine eventId
    const user = await userCollection.findOne({userId})

    if (!user) {
        return res.status(404).json({error: 'User not found'})
    }

    const {eventId} = user

    // ✅ Delete the user
    await userCollection.deleteOne({userId})

    // ✅ Remove from eventParticipants
    await participantCollection.deleteOne({eventId, userId})

    // ✅ Pull userId from event.participantIds
    await eventCollection.updateOne(
        {eventId},
        {$pull: {participantIds: userId}}
    )

    res.status(200).json({message: 'User deleted and event references cleaned up'})
})

// Get User Review (now much faster!)
router.get('/:userId/review/:eventId', async (req: Request, res: Response) => {
    const { userId, eventId } = req.params

    const reviewCollection = getReviewCollection()
    
    // First, try to get existing review
    let review = await reviewCollection.findOne({ userId, eventId })
    
    // If no review exists, generate one on-demand (lazy population)
    if (!review) {
        try {
            console.log(`🔄 No review found, generating on-demand for user ${userId}`)
            await updateUserReview(userId, eventId)
            review = await reviewCollection.findOne({ userId, eventId })
        } catch (error) {
            console.error(`❌ Failed to generate review on-demand:`, error)
            return res.status(500).json({ error: 'Failed to generate review' })
        }
    }
    
    if (!review) {
        return res.status(404).json({ error: 'Review not found and generation failed' })
    }

    res.json(review)
})

// Regenerate User Review (admin only - for manual refresh)
router.post('/:userId/review/:eventId/regenerate', verifyFirebaseToken, async (req: Request, res: Response) => {
    // Check if user is admin (you might want to add this check)
    // if (!isAdmin(req)) {
    //     return res.status(403).json({ error: 'Only admins can regenerate reviews' })
    // }
    
    const { userId, eventId } = req.params

    try {
        console.log(`🔄 Manually regenerating review for user ${userId} in event ${eventId}`)
        await updateUserReview(userId, eventId)
        
        const reviewCollection = getReviewCollection()
        const review = await reviewCollection.findOne({ userId, eventId })
        
        if (!review) {
            return res.status(500).json({ error: 'Failed to regenerate review' })
        }
        
        res.json({ 
            message: 'Review regenerated successfully',
            review 
        })
    } catch (error) {
        console.error(`❌ Failed to manually regenerate review:`, error)
        res.status(500).json({ error: 'Failed to regenerate review' })
    }
})

export default router
