import {getDB} from '../db'
import {UserActivity} from "../models/userActivity";

const COLLECTION_NAME = 'userActivities'

export const userActivityCollection = () => {
    const db = getDB()
    return db.collection<UserActivity>(COLLECTION_NAME)
}
