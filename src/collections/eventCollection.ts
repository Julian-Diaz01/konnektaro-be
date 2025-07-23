import { getDB } from '../db'
import { Event } from '../models/event'

const COLLECTION_NAME = 'events'

export const getEventCollection = () => {
    const db = getDB()
    return db.collection<Event>(COLLECTION_NAME)
}
