export type ActivityType = 'self' | 'partner'

export interface Activity {
    activityId: string
    type: ActivityType
    question: string
    notePlaceholder: string
    saveEnabled: boolean
}

export interface ActivityGroup {
    activityId: string
    group: number
    partnerId?: string
    partnerName?: string
}