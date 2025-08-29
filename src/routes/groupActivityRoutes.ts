import {Router, Request, Response} from 'express'
import {ParticipantUser} from '../models/user'
import {verifyFirebaseToken} from '../middleware/authMiddleware'
import {ActivityGroupItem, createGroupActivity} from '../models/groupActivity'
import {v4 as uuidv4} from 'uuid'
import {getGroupActivityCollection} from '../collections/getGroupActivityCollection'
import {chunk} from 'lodash'
import {getUserCollection} from "../collections/userCollection";
import {getEventCollection} from "../collections/eventCollection";
import {emitGroupsCreated} from "../sockets/groupActivitySockets";
import {updateUserReview} from '../services/reviewService'

const router = Router()
console.log('🐀 Initializing /group-activity routes')


// Fetch GroupActivity by groupActivityId
router.get('/:groupActivityId', verifyFirebaseToken, async (req: Request, res: Response) => {
    try {
        const {groupActivityId} = req.params

        const groupCollection = getGroupActivityCollection()
        const groupActivity = await groupCollection.findOne({groupActivityId})

        if (!groupActivity) {
            return res.status(404).json({message: 'Group activity not found'})
        }

        res.json(groupActivity)
    } catch (error) {
        console.error('Error fetching group activity:', error)
        res.status(500).json({message: 'Internal server error'})
    }
})

// Fetch GroupActivity by activityId
router.get('/activity/:activityId', verifyFirebaseToken, async (req: Request, res: Response) => {
    try {
        const {activityId} = req.params

        const groupCollection = getGroupActivityCollection()
        const groupActivity = await groupCollection.findOne({activityId})

        if (!groupActivity) {
            return res.status(404).json({message: 'Group activity not found'})
        }

        res.json(groupActivity)
    } catch (error) {
        console.error('Error fetching group activity:', error)
        res.status(500).json({message: 'Internal server error'})
    }
})


// Create GroupActivity to group users into pairs for an activity
router.post(
    '/:eventId/activity/:activityId',
    verifyFirebaseToken,
    async (req: Request, res: Response) => {
        console.log('🐀 Creating group activity')
        try {
            const {eventId, activityId} = req.params

            const userCollection = getUserCollection()
            const eventCollection = getEventCollection()
            const groupCollection = getGroupActivityCollection()

            // Check if GroupActivity already exists for this activity
            const existingGroupActivity = await groupCollection.findOne({activityId})

            const users = await userCollection
                .find({eventId}, {projection: {userId: 1, name: 1, icon: 1, description: 1}})
                .toArray()

            if (users.length === 0) {
                return res.status(404).json({message: 'No users found for this event'})
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
                    description: user.description,
                    email: user.email,
                }))

                const groupColor = groupColors[index % groupColors.length]

                groups.push({
                    groupId: uuidv4(),
                    groupNumber: index + 1,
                    groupColor,
                    participants
                })
            })

            let groupActivity
            let responseStatus

            if (existingGroupActivity) {
                // Update existing GroupActivity with new groups
                await groupCollection.updateOne(
                    {activityId},
                    {
                        $set: {
                            groups,
                            share: req.body?.share ?? existingGroupActivity.share,
                            active: true
                        }
                    }
                )

                // Get the updated document
                groupActivity = await groupCollection.findOne({activityId})
                responseStatus = 200
            } else {
                // Create new GroupActivity
                groupActivity = createGroupActivity({
                    activityId,
                    groups,
                    active: true,
                    share: req.body?.share ?? false
                })

                await groupCollection.insertOne(groupActivity)
                responseStatus = 201
            }

            await eventCollection.updateOne(
                {eventId},
                {$addToSet: {activityIds: activityId}}
            )

            // Emit socket event for groups created
            emitGroupsCreated(eventId, activityId)

            // ✅ AUTO-UPDATE ALL USER REVIEWS after group changes
            try {
                const allUserIds = users.map(user => user.userId)
                console.log(`🔄 Updating reviews for ${allUserIds.length} users after group changes`)
                
                for (const userId of allUserIds) {
                    try {
                        await updateUserReview(userId, eventId)
                        console.log(`✅ Updated review for user ${userId}`)
                    } catch (error) {
                        console.error(`❌ Failed to update review for user ${userId}:`, error)
                    }
                }
            } catch (error) {
                console.error(`❌ Failed to update reviews after group changes:`, error)
                // Don't fail the main request if review updates fail
            }

            res.status(responseStatus).json(groupActivity)
        } catch (error) {
            console.error('Error creating/updating group activity:', error)
            res.status(500).json({message: 'Internal server error'})
        }
    }
)

export default router

