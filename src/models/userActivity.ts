import {v4 as uuidv4} from "uuid";

export interface UserActivity {
    userActivityId: string
    activityId: string
    userId: string
    groupId?: string
    date: string
    notes: string
}

export const createUserActivity = (data: Omit<UserActivity, 'userActivityId'>): UserActivity => {
    return {
        userActivityId: uuidv4(),
        ...data
    }
}