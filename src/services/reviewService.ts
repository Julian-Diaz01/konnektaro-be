import { getReviewCollection } from '../collections/reviewCollection'
import { getUserCollection } from '../collections/userCollection'
import { getEventCollection } from '../collections/eventCollection'
import { getActivityCollection } from '../collections/activityCollection'
import { getUserActivityCollection } from '../collections/userActivityCollection'
import { getGroupActivityCollection } from '../collections/getGroupActivityCollection'
import { createReview, Review } from '../models/review'

export const generateUserReview = async (userId: string, eventId: string): Promise<Review> => {
    const userCollection = getUserCollection()
    const eventCollection = getEventCollection()
    const activityCollection = getActivityCollection()
    const userActivityCollection = getUserActivityCollection()
    const groupActivityCollection = getGroupActivityCollection()

    // Parallel execution of independent queries
    const [user, event] = await Promise.all([
        userCollection.findOne({ userId, eventId }),
        eventCollection.findOne({ eventId })
    ])

    if (!user) throw new Error('User not found in event')
    if (!event) throw new Error('Event not found')

    const activityIds = event.activityIds || []
    if (activityIds.length === 0) {
        return createReview({
            userId,
            eventId,
            event: {
                name: event.name,
                description: event.description,
                picture: event.picture || null
            },
            activities: []
        })
    }

    // Batch fetch all activities
    const activities = await activityCollection.find({ 
        activityId: { $in: activityIds } 
    }).toArray()

    // Batch fetch all user activities for this user and event
    const userActivities = await userActivityCollection.find({ 
        userId, 
        activityId: { $in: activityIds } 
    }).toArray()

    // Create lookup maps for O(1) access
    const userActivityMap = new Map(
        userActivities.map(ua => [ua.activityId, ua])
    )

    // Only fetch group activities if there are partner activities
    const partnerActivities = activities.filter(a => a.type === 'partner')
    let groupActivityMap = new Map()
    
    if (partnerActivities.length > 0) {
        const partnerActivityIds = partnerActivities.map(a => a.activityId)
        const groupActivities = await groupActivityCollection.find({ 
            activityId: { $in: partnerActivityIds } 
        }).toArray()
        
        groupActivityMap = new Map(
            groupActivities.map(ga => [ga.activityId, ga])
        )
    }

    // Process activities in memory
    const reviewActivities = activities.map(activity => {
        const result: any = {
            activityId: activity.activityId,
            type: activity.type,
            title: activity.title,
            question: activity.question,
            selfAnswer: userActivityMap.get(activity.activityId)?.notes || null,
            partnerAnswer: null,
            groupColor: null,
            groupNumber: null
        }

        if (activity.type === 'partner') {
            const groupActivity = groupActivityMap.get(activity.activityId)
            if (groupActivity) {
                const group = groupActivity.groups.find((g: { participants: { userId: string }[] }) => 
                    g.participants.some((p: { userId: string }) => p.userId === userId)
                )
                
                if (group) {
                    result.groupColor = group.groupColor
                    result.groupNumber = group.groupNumber
                    
                    const partner = group.participants.find((p: { userId: string }) => p.userId !== userId)
                    if (partner) {
                        result.partnerAnswer = {
                            notes: null, // Will be populated below if needed
                            name: partner.name,
                            icon: partner.icon,
                            email: null, // Will be populated below if needed
                            description: partner.description
                        }
                    }
                }
            }
        }

        return result
    })

    // Batch fetch partner details only if needed
    const partnerUserIds = new Set<string>()
    reviewActivities.forEach(item => {
        if (item.partnerAnswer && item.partnerAnswer.notes === null) {
            const groupActivity = groupActivityMap.get(item.activityId)
            if (groupActivity) {
                const group = groupActivity.groups.find((g: { participants: { userId: string }[] }) => 
                    g.participants.some((p: { userId: string }) => p.userId === userId)
                )
                if (group) {
                    const partner = group.participants.find((p: { userId: string }) => p.userId !== userId)
                    if (partner) partnerUserIds.add(partner.userId)
                }
            }
        }
    })

    // Batch fetch partner user activities and user details
    if (partnerUserIds.size > 0) {
        const partnerUserIdsArray = Array.from(partnerUserIds)
        const [partnerUserActivities, partnerUsers] = await Promise.all([
            userActivityCollection.find({ 
                userId: { $in: partnerUserIdsArray },
                activityId: { $in: activityIds }
            }).toArray(),
            userCollection.find({ 
                userId: { $in: partnerUserIdsArray }
            }).toArray()
        ])

        const partnerUserMap = new Map(
            partnerUsers.map(u => [u.userId, u])
        )
        const partnerActivityMap = new Map(
            partnerUserActivities.map(ua => [ua.userId + '_' + ua.activityId, ua])
        )

        // Populate partner answers
        reviewActivities.forEach(item => {
            if (item.partnerAnswer && item.partnerAnswer.notes === null) {
                const groupActivity = groupActivityMap.get(item.activityId)
                if (groupActivity) {
                    const group = groupActivity.groups.find((g: { participants: { userId: string }[] }) => 
                        g.participants.some((p: { userId: string }) => p.userId === userId)
                    )
                    if (group) {
                        const partner = group.participants.find((p: { userId: string }) => p.userId !== userId)
                        if (partner) {
                            const partnerUser = partnerUserMap.get(partner.userId)
                            const partnerActivity = partnerActivityMap.get(partner.userId + '_' + item.activityId)
                            
                            if (partnerActivity) {
                                item.partnerAnswer.notes = partnerActivity.notes
                            }
                            if (partnerUser) {
                                item.partnerAnswer.email = partnerUser.email
                            }
                        }
                    }
                }
            }
        })
    }

    return createReview({
        userId,
        eventId,
        event: {
            name: event.name,
            description: event.description,
            picture: event.picture || null
        },
        activities: reviewActivities
    })
}

export const updateUserReview = async (userId: string, eventId: string): Promise<void> => {
    const reviewCollection = getReviewCollection()
    
    try {
        // Generate fresh review data
        const reviewData = await generateUserReview(userId, eventId)
        
        // Upsert the review
        await reviewCollection.updateOne(
            { userId, eventId },
            { 
                $set: { 
                    ...reviewData,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        )
    } catch (error) {
        console.error(`Failed to update review for user ${userId} in event ${eventId}:`, error)
        throw error
    }
}

export const deleteUserReview = async (userId: string, eventId: string): Promise<void> => {
    const reviewCollection = getReviewCollection()
    await reviewCollection.deleteOne({ userId, eventId })
}

