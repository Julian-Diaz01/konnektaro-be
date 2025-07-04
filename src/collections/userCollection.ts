import { getDB } from '../db'
import { User } from '../models/user'

const COLLECTION_NAME = 'users'

export const getUserCollection = () => {
    const db = getDB()
    return db.collection<User>(COLLECTION_NAME)
}
