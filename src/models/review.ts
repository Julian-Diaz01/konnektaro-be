import { v4 as uuidv4 } from 'uuid'

export interface Review {
    reviewId: string
    userId: string
    eventId: string
    createdAt: Date
    updatedAt: Date
    event: {
        name: string
        description: string
        picture: string | null
    }
    activities: ReviewActivity[]
}

export interface ReviewActivity {
    activityId: string
    type: 'individual' | 'partner' | 'group'
    title: string
    question: string
    selfAnswer: string | null
    partnerAnswer: ReviewPartnerAnswer | null
    groupColor: string | null
    groupNumber: number | null
}

export interface ReviewPartnerAnswer {
    notes: string | null
    name: string
    icon: string
    email: string | null
    description: string
}

export const createReview = (data: Omit<Review, 'reviewId' | 'createdAt' | 'updatedAt'>): Review => {
    return {
        reviewId: uuidv4(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
    }
}