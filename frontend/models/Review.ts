export interface Review {
    reviewId: string
    userId: string
    eventId: string
    createdAt: string // ISO date string from backend
    updatedAt: string // ISO date string from backend
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

// Frontend-specific types for state management
export interface ReviewState {
    review: Review | null
    loading: boolean
    error: string | null
}

export interface ReviewActions {
    fetchReview: (userId: string, eventId: string) => Promise<void>
    refreshReview: (userId: string, eventId: string) => Promise<void>
    clearReview: () => void
}

// Utility types for filtering and searching
export interface ReviewFilters {
    activityType?: 'individual' | 'partner' | 'group'
    hasPartnerAnswer?: boolean
    hasSelfAnswer?: boolean
}

// Response types for API calls
export interface ReviewResponse {
    success: boolean
    data?: Review
    error?: string
}

// Hook return type for React components
export interface UseReviewReturn {
    review: Review | null
    loading: boolean
    error: string | null
    fetchReview: (userId: string, eventId: string) => Promise<void>
    refreshReview: (userId: string, eventId: string) => Promise<void>
    clearReview: () => void
}

