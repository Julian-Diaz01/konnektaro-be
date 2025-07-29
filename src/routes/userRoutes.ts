import {Request, Response, Router} from 'express'
import {getUserCollection} from '../collections/userCollection'
import {createUser, User} from '../models/user'
import {verifyFirebaseToken} from "../middleware/authMiddleware";
import {getEventCollection} from "../collections/eventCollection";
import {getEventParticipantsCollection} from "../collections/eventParticipantsCollection";
import {getActivityCollection} from "../collections/activityCollection";
import {getUserActivityCollection} from "../collections/userActivityCollection";
import {getGroupActivityCollection} from "../collections/getGroupActivityCollection";

const router = Router()
console.log("🐱 Initializing /user routes")

// Create User
router.post('/', verifyFirebaseToken, async (req: Request, res: Response) => {
    const {eventId, name, email, icon, description, role, userId} = req.body

    if (!eventId || !name || !email || !icon || !description || !role || !userId) {
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

// Get User Review
router.get('/:userId/review/:eventId', async (req: Request, res: Response) => {
    const { userId, eventId } = req.params

    const userCollection = getUserCollection()
    const eventCollection = getEventCollection()
    const activityCollection = getActivityCollection()
    const userActivityCollection = getUserActivityCollection()
    const groupActivityCollection = getGroupActivityCollection()

    const user = await userCollection.findOne({ userId, eventId })
    if (!user) return res.status(404).json({ error: 'User not found in event' })

    const event = await eventCollection.findOne({ eventId })
    if (!event) return res.status(404).json({ error: 'Event not found' })

    const activityIds = event.activityIds || []

    const review = await Promise.all(
        activityIds.map(async (activityId) => {
            const activity = await activityCollection.findOne({ activityId })
            if (!activity) return null

            const result: any = {
                activityId: activity.activityId,
                type: activity.type,
                title: activity.title,
                question: activity.question,
                selfAnswer: null,
                partnerAnswer: null,
                groupColor: null,
                groupNumber: null
            }

            const selfActivity = await userActivityCollection.findOne({ userId, activityId })
            if (selfActivity) result.selfAnswer = selfActivity.notes

            if (activity.type === 'partner') {
                const groupActivity = await groupActivityCollection.findOne({ activityId })
                if (groupActivity) {
                    const group = groupActivity.groups.find(g => g.participants.some(p => p.userId === userId))
                    if (group) {
                        const partner = group.participants.find(p => p.userId !== userId)
                        result.groupColor = group.groupColor
                        result.groupNumber = group.groupNumber

                        if (partner) {
                            const fetchedPartner = await userCollection.findOne({userId: partner.userId})
                            const partnerActivity = await userActivityCollection.findOne({
                                userId: partner.userId,
                                activityId
                            })
                            if (partnerActivity) {
                                result.partnerAnswer = {
                                    notes: partnerActivity.notes,
                                    name: partner.name,
                                    icon: partner.icon,
                                    email: fetchedPartner?.email || null,
                                    description: partner.description
                                }
                            }
                        }
                    }
                }
            }

            return result
        })
    )

    const filteredReview = review.filter(r => r !== null)

    res.json({
        userId,
        eventId,
        event: {
            name: event.name,
            description: event.description,
            picture: event.picture || null
        },
        activities: filteredReview
    })
})



export default router
