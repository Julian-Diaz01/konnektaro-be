import { v4 as uuidv4 } from 'uuid'

export interface Session {
    sessionId: string
    name: string
    description: string
    picture?: string
    activityIds: string[]
}

export const createSession = (data: Omit<Session, 'sessionId'>): Session => {
    return {
        sessionId: uuidv4(),
        ...data
    }
}
