import {getDB} from '../db'
import {GroupActivity} from '../models/groupActivity'

const COLLECTION_NAME = 'groupActivities'

export const getGroupActivityCollection = () => {
    const db = getDB()
    return db.collection<GroupActivity>(COLLECTION_NAME)
}

