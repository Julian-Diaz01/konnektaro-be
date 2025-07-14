import { v4 as uuidv4 } from 'uuid'

export type Role = 'admin' | 'user'

export interface User {
    userId: string
    sessionId: string
    name: string
    email: string
    icon: string
    description: string
    role: Role
    userActivityIds?: string[]
}

export type ParticipantUser = Pick<User, 'userId' | 'name' | 'icon' | 'description'>

export const createUser = (data: Omit<User, 'userId'>): User => {
    return {
        userId: uuidv4(),
        ...data
    }
}
