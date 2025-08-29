export type Role = 'admin' | 'user'

export interface User {
    userId: string
    eventId: string
    name: string
    email: string
    icon: string
    description: string
    role: Role
    userActivityIds?: string[]
}

export type ParticipantUser = Pick<User, 'userId' | 'name' | 'icon' | 'description' | 'email'>

export const createUser = (data: User): User => {
    return {
        ...data
    }
}
