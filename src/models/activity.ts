import {v4 as uuidv4} from "uuid";

export type ActivityType = 'self' | 'partner'

export interface Activity {
    activityId: string
    type: ActivityType
    question: string
    saveEnabled: boolean
    sendToPartner: true
}

export interface ActivityGroup {
    activityId: string
    group: number
    partnerId?: string
    partnerName?: string
}

export const createActivity = (data: Omit<Activity, 'activityId'>): Activity => {
    return {
        activityId: uuidv4(),
        ...data
    }
}