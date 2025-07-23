import {getDB} from '../db'
import {EventParticipant} from '../models/eventParticipant'

const COLLECTION_NAME = 'eventParticipants'

export const getEventParticipantsCollection = () => {
    const db = getDB()
    return db.collection<EventParticipant>(COLLECTION_NAME)
}
