import {Request, Response, Router} from 'express'
import {getUserCollection} from '../collections/userCollection'
import {createUser, User} from '../models/user'
import {verifyFirebaseToken} from "../middleware/authMiddleware";
import {getSessionCollection} from "../collections/sessionCollection";
import {getSessionParticipantsCollection} from "../collections/sessionParticipantsCollection";
import {getActivityCollection} from "../collections/activityCollection";
import {getUserActivityCollection} from "../collections/userActivityCollection";
import {getGroupActivityCollection} from "../collections/getGroupActivityCollection";

const router = Router()
console.log("🐱 Initializing /user routes")

// Create User
router.post('/', verifyFirebaseToken, async (req: Request, res: Response) => {
    const {sessionId, name, email, icon, description, role} = req.body

    if (!sessionId || !name || !email || !icon || !description || !role) {
        return res.status(400).json({error: 'Missing required fields'})
    }

    const sessionCollection = getSessionCollection()
    const session = await sessionCollection.findOne({sessionId: sessionId, open: true})
    if (!session) {
        return res.status(400).json({error: 'Session not found or not open'})
    }

    const user = createUser({
        sessionId,
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

    // ✅ Register user in sessionParticipants
    const sessionParticipantCollection = getSessionParticipantsCollection()
    await sessionParticipantCollection.insertOne({
        sessionId,
        userId: user.userId
    })
    // ✅ Also update the session's participantIds array
    await sessionCollection.updateOne(
        {sessionId},
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
    const participantCollection = getSessionParticipantsCollection()
    const sessionCollection = getSessionCollection()

    // ✅ Get user to determine sessionId
    const user = await userCollection.findOne({userId})

    if (!user) {
        return res.status(404).json({error: 'User not found'})
    }

    const {sessionId} = user

    // ✅ Delete the user
    await userCollection.deleteOne({userId})

    // ✅ Remove from sessionParticipants
    await participantCollection.deleteOne({sessionId, userId})

    // ✅ Pull userId from session.participantIds
    await sessionCollection.updateOne(
        {sessionId},
        {$pull: {participantIds: userId}}
    )

    res.status(200).json({message: 'User deleted and session references cleaned up'})
})

// Get User Review
router.get('/:userId/review/:sessionId', async (req: Request, res: Response) => {
    const { userId, sessionId } = req.params

    const userCollection = getUserCollection()
    const sessionCollection = getSessionCollection()
    const activityCollection = getActivityCollection()
    const userActivityCollection = getUserActivityCollection()
    const groupActivityCollection = getGroupActivityCollection()

    const user = await userCollection.findOne({ userId, sessionId })
    if (!user) return res.status(404).json({ error: 'User not found in session' })

    const session = await sessionCollection.findOne({ sessionId })
    if (!session) return res.status(404).json({ error: 'Session not found' })

    const activityIds = session.activityIds || []

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
        sessionId,
        session: {
            name: session.name,
            description: session.description,
            picture: session.picture || null
        },
        activities: filteredReview
    })
})



export default router
