import { Router, Request, Response } from 'express'
import { verifyFirebaseToken } from "../middleware/authMiddleware"
import {getEventParticipantsCollection} from "../collections/eventParticipantsCollection";

const router = Router()
console.log('🙊 Initializing /event/participants routes')
// Get Participants in Event
router.get('/:eventId/participants', verifyFirebaseToken, async (req: Request, res: Response) => {
    const { eventId } = req.params

    const eventParticipantsCollection = getEventParticipantsCollection()
    const participants = await eventParticipantsCollection.find({ eventId }).toArray()

    if (participants.length === 0) return res.status(404).json({ message: 'No participants found' })

    res.status(200).json(participants)
})

export default router
