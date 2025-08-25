import { v4 as uuidv4 } from 'uuid'

export interface Event {
    eventId: string
    name: string
    description: string
    picture?: string
    activityIds?: string[]
    open: boolean
    participantIds: string[]
    currentActivityId?: string | null
    showReview: boolean
}

export const createEvent = (data: Omit<Event, 'eventId'>): Event => {
    return {
        eventId: uuidv4(),
        ...data
    }
}
