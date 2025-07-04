import { getDB } from '../db'
import { Session } from '../models/session'

const COLLECTION_NAME = 'sessions'

export const getSessionCollection = () => {
    const db = getDB()
    return db.collection<Session>(COLLECTION_NAME)
}
