import {v4 as uuidv4} from "uuid";
import {ParticipantUser} from "./user";

export interface GroupActivity {
    groupActivityId: string
    activityId: string
    groups: ActivityGroupItem[]
    active: boolean
}

export interface ActivityGroupItem {
    groupId: string
    groupNumber: number
    groupColor: string
    participants: ParticipantUser []
}

export const createGroupActivity = (data: Omit<GroupActivity, 'groupActivityId'>): GroupActivity => {
    return {
        groupActivityId: uuidv4(),
        ...data
    }
}