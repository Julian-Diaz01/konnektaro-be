import {getDB} from '../db'
import {SessionParticipant} from '../models/sessionParticipant'

const COLLECTION_NAME = 'sessionParticipants'

export const getSessionParticipantsCollection = () => {
    const db = getDB()
    return db.collection<SessionParticipant>(COLLECTION_NAME)
}
