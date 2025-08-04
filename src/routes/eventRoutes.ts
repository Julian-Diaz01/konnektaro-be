import {Router, Request, Response} from 'express'
import {getEventCollection} from '../collections/eventCollection'
import {getUserCollection} from '../collections/userCollection'
import {createEvent} from '../models/event'
import {ParticipantUser} from '../models/user'
import {verifyFirebaseToken} from '../middleware/authMiddleware'
import {ActivityGroupItem, createGroupActivity} from '../models/groupActivity'
import {v4 as uuidv4} from 'uuid'
import {getGroupActivityCollection} from '../collections/getGroupActivityCollection'
import {chunk} from 'lodash'
import {isAdmin} from "../hooks/isAdmin";

const router = Router()
console.log('🐀 Initializing /event routes')

// Create Event (admin only)
router.post('/', verifyFirebaseToken, async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
        return res.status(403).json({error: 'Only admins can create events'})
    }
    const {name, description, picture} = req.body

    if (!name || !description) {
        return res.status(400).json({error: 'Missing required fields'})
    }

    const event = createEvent({
        name,
        description,
        picture,
        activityIds: [],
        open: true,
        participantIds: []
    })

    const collection = getEventCollection()
    await collection.insertOne(event)

    res.status(201).json(event)
})
// Update Event (admin only)
router.patch('/:eventId', verifyFirebaseToken, async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
        return res.status(403).json({error: 'Only admins can edit events'})
    }

    const {eventId} = req.params
    const {name, description, picture, open} = req.body

    if (!eventId) {
        return res.status(400).json({error: 'Missing event ID'})
    }

    const collection = getEventCollection()
    const existing = await collection.findOne({eventId})

    if (!existing) {
        return res.status(404).json({error: 'Event not found'})
    }

    const updatedFields: Partial<typeof existing> = {}
    if (name) updatedFields.name = name
    if (description) updatedFields.description = description
    if (picture !== undefined) updatedFields.picture = picture
    if (open !== undefined) updatedFields.open = open

    await collection.updateOne({eventId}, {$set: updatedFields})
    const updatedEvent = await collection.findOne({eventId})

    res.json(updatedEvent)
})
// Get event by ID (admin only)
router.get('/:eventId', verifyFirebaseToken, async (req: Request, res: Response) => {
    const {eventId} = req.params
    const collection = getEventCollection()
    const event = await collection.findOne({eventId})

    if (!event) return res.status(404).json({error: 'Event not found'})

    res.json(event)
})
// Get event Status by ID
router.get('/status/:eventId', verifyFirebaseToken, async (req: Request, res: Response) => {
    const {eventId} = req.params
    const collection = getEventCollection()
    const event = await collection.findOne({eventId})

    if (!event) return res.status(404).json({error: 'Event not found'})

    res.json({"name": event.name, "open": event.open})
})
// List all events (admin only)
router.get('/', verifyFirebaseToken, async (req: Request, res: Response) => {
    const collection = getEventCollection()
    const events = await collection.find({}).toArray()
    res.json(events)
})

// Delete event (admin only)
router.delete('/:eventId', verifyFirebaseToken, async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
        return res.status(403).json({error: 'Only admins can delete events'})
    }

    const {eventId} = req.params
    const collection = getEventCollection()
    await collection.deleteOne({eventId})
    res.json({message: 'Event deleted'})
})

// Pair Users into GroupActivity
router.post(
    '/:eventId/activity-group/:activityId',
    verifyFirebaseToken,
    async (req: Request, res: Response) => {
        try {
            const {eventId, activityId} = req.params

            const userCollection = getUserCollection()
            const eventCollection = getEventCollection()
            const groupCollection = getGroupActivityCollection()

            // Remove previous groups for this activity if re-triggered
            await groupCollection.deleteMany({activityId})

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
                    description: user.description
                }))

                const groupColor = groupColors[index % groupColors.length]

                groups.push({
                    groupId: uuidv4(),
                    groupNumber: index + 1,
                    groupColor,
                    participants
                })
            })

            const groupActivity = createGroupActivity({
                activityId,
                groups,
                active: true,
                share: req.body?.share ?? false
            })

            await groupCollection.insertOne(groupActivity)

            await eventCollection.updateOne(
                {eventId},
                {$addToSet: {activityIds: activityId}}
            )

            res.status(201).json(groupActivity)
        } catch (error) {
            console.error('Error creating group activity:', error)
            res.status(500).json({message: 'Internal server error'})
        }
    }
)

export default router
