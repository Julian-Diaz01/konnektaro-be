import { Router, Request, Response } from 'express'
import { verifyFirebaseToken } from "../middleware/authMiddleware"
import {getSessionParticipantsCollection} from "../collections/sessionParticipantsCollection";

const router = Router()
console.log('🙊 Initializing /session/participants routes')
// Get Participants in Session
router.get('/:sessionId/participants', verifyFirebaseToken, async (req: Request, res: Response) => {
    const { sessionId } = req.params

    const sessionParticipantsCollection = getSessionParticipantsCollection()
    const participants = await sessionParticipantsCollection.find({ sessionId }).toArray()

    if (participants.length === 0) return res.status(404).json({ message: 'No participants found' })

    res.status(200).json(participants)
})

export default router
