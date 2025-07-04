import { getDB } from '../db'
import { Activity } from '../models/activity'

export const getActivityCollection = () => {
    const db = getDB()
    return db.collection<Activity>('activities')
}
