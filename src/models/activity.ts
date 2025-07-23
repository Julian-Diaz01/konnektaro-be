import {v4 as uuidv4} from "uuid";

export type ActivityType = 'self' | 'partner'

export interface Activity {
    activityId: string
    eventId: string
    date: string
    type: ActivityType
    question: string
    title: string
}


export const createActivity = (data: Omit<Activity, 'activityId'>): Activity => {
    return {
        activityId: uuidv4(),
        ...data
    }
}