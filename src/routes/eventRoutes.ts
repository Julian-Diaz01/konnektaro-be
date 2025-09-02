import {Router, Request, Response} from 'express'
import {getEventCollection} from '../collections/eventCollection'
import {getUserCollection} from '../collections/userCollection'
import {createEvent} from '../models/event'
import {verifyFirebaseToken} from '../middleware/authMiddleware'
import {isAdmin} from "../hooks/isAdmin";
import {emitActivityUpdate} from "../sockets/activitySockets";
import {updateUserReview} from '../services/reviewService'
import {getSocketServer} from '../socket'

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
        participantIds: [],
        showReview: false
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
// Close event (set open=false) — admin only, no body required
router.patch('/:eventId/close', verifyFirebaseToken, async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
        return res.status(403).json({ error: 'Only admins can close events' })
    }

    const { eventId } = req.params
    if (!eventId) {
        return res.status(400).json({ error: 'Missing event ID' })
    }

    const collection = getEventCollection()
    const existing = await collection.findOne({ eventId })
    if (!existing) {
        return res.status(404).json({ error: 'Event not found' })
    }

    if (!existing.open) {
        return res.status(200).json({ message: 'Event already closed', event: existing })
    }

    await collection.updateOne({ eventId }, { $set: { open: false } })
    const updatedEvent = await collection.findOne({ eventId })
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
    const events = await collection.find({ open: true }).toArray()
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

        // ✅ AUTO-UPDATE ALL PARTICIPANT REVIEWS when event activity changes
        try {
            const event = await collection.findOne({ eventId });
            if (event && event.participantIds && event.participantIds.length > 0) {
                console.log(`🔄 Updating reviews for ${event.participantIds.length} participants after activity change`)
                
                for (const userId of event.participantIds) {
                    try {
                        await updateUserReview(userId, eventId)
                        console.log(`✅ Updated review for participant ${userId}`)
                    } catch (error) {
                        console.error(`❌ Failed to update review for participant ${userId}:`, error)
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Failed to update reviews after activity change:`, error)
            // Don't fail the main request if review updates fail
        }

        res.json({ message: 'Active activity updated' });
    }
)

// Add/Remove activities to event (admin only)
router.patch(
    '/:eventId/activities',
    verifyFirebaseToken,
    async (req: Request, res: Response) => {
        if (!isAdmin(req)) {
            return res.status(403).json({ error: 'Only admins can manage event activities' });
        }

        const { eventId } = req.params;
        const { action, activityId } = req.body; // action: 'add' or 'remove'

        if (!action || !activityId) {
            return res.status(400).json({ error: 'Missing action or activityId' });
        }

        const collection = getEventCollection();
        const event = await collection.findOne({ eventId });
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (action === 'add') {
            await collection.updateOne(
                { eventId },
                { $addToSet: { activityIds: activityId } }
            );
        } else if (action === 'remove') {
            await collection.updateOne(
                { eventId },
                { $pull: { activityIds: activityId } }
            );
        } else {
            return res.status(400).json({ error: 'Invalid action. Use "add" or "remove"' });
        }

        // ✅ AUTO-UPDATE ALL PARTICIPANT REVIEWS when event activities change
        try {
            if (event.participantIds && event.participantIds.length > 0) {
                console.log(`🔄 Updating reviews for ${event.participantIds.length} participants after activities change`)
                
                for (const userId of event.participantIds) {
                    try {
                        await updateUserReview(userId, eventId)
                        console.log(`✅ Updated review for participant ${userId}`)
                    } catch (error) {
                        console.error(`❌ Failed to update review for participant ${userId}:`, error)
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Failed to update reviews after activities change:`, error)
            // Don't fail the main request if review updates fail
        }

        res.json({ message: `Activity ${action}ed successfully` });
    }
)

// Toggle review access for an event (admin only)
router.patch(
    '/:eventId/review-access/:action',
    verifyFirebaseToken,
    async (req: Request, res: Response) => {
        if (!isAdmin(req)) {
            return res.status(403).json({ error: 'Only admins can modify review access' });
        }

        const { eventId, action } = req.params;
        // Removed unsafe destructuring from req.body which could be undefined
        // const { showReview } = req.body;

        if (!['enable', 'disable'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action. Use "enable" or "disable"' });
        }

        const collection = getEventCollection();
        const event = await collection.findOne({ eventId });
        
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const newShowReview = action === 'enable';
        const socketEvent = newShowReview ? 'reviewOn' : 'reviewOff';
        const message = newShowReview ? 'Review access granted for this event' : 'Review access cancelled for this event';
        const logMessage = newShowReview ? 'enabled' : 'disabled';

        // Update the event
        await collection.updateOne(
            { eventId },
            { $set: { showReview: newShowReview } }
        );

        // Emit socket event to all users in the event
        try {
            const socketServer = getSocketServer();
            socketServer.to(eventId).emit(socketEvent, {
                eventId,
                message,
                timestamp: new Date().toISOString()
            });
            console.log(`✅ Review access ${logMessage} for event ${eventId}`);
        } catch (error) {
            console.error(`❌ Failed to emit socket event for event ${eventId}:`, error);
        }

        res.json({ 
            message: `Review access ${logMessage}`, 
            showReview: newShowReview 
        });
    }
);

export default router
