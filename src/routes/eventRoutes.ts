import {Router, Request, Response} from 'express'
import {getEventCollection} from '../collections/eventCollection'
import {getUserCollection} from '../collections/userCollection'
import {createEvent} from '../models/event'
import {verifyFirebaseToken} from '../middleware/authMiddleware'
import {isAdmin} from "../hooks/isAdmin";
import {emitActivityUpdate} from "../sockets/activitySockets";

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
// Get all users of an event with only specific fields
router.get('/:eventId/users', verifyFirebaseToken, async (req: Request, res: Response) => {
    try {
        const {eventId} = req.params;

        const eventCollection = getEventCollection();
        const userCollection = getUserCollection();
        // Find the event to get participant IDs
        const event = await eventCollection.findOne({eventId});

        if (!event) {
            return res.status(404).json({error: 'Event not found'});
        }

        const participantIds = event.participantIds || [];
        if (participantIds.length === 0) {
            return res.json([]); // No participants in the event
        }

        // Fetch user details for the participant IDs
        const users = await userCollection
            .find({userId: {$in: participantIds}})
            .project({userId: 1, name: 1, email: 1, description: 1, _id: 0})
            .toArray();

        res.json(users);
    } catch (error) {
        console.error('Error fetching users for event:', error);

        // Type-check and handle the error
        if (error instanceof Error) {
            res.status(500).json({error: 'Internal Server Error', details: error.message});
        } else {
            res.status(500).json({error: 'Internal Server Error', details: String(error)});
        }
    }
});
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
// Add active Activity to event (admin only)
router.patch(
    '/:eventId/current-activity',
    verifyFirebaseToken,
    async (req: Request, res: Response) => {
        if (!isAdmin(req)) {
            return res.status(403).json({ error: 'Only admins can set active activity' });
        }

        const { eventId } = req.params;
        const { activityId } = req.body;

        const collection = getEventCollection();
        const event = await collection.findOne({ eventId });
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        await collection.updateOne(
            { eventId },
            { $set: { currentActivityId: activityId } }
        );

        // ✅ Emit socket event here
        emitActivityUpdate(eventId, activityId);

        res.json({ message: 'Active activity updated' });
    }
)

export default router
