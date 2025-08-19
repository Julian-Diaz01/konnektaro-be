import { Collection, Db } from 'mongodb'
import { Review } from '../models/review'
import { getDB } from '../db'

let reviewCollection: Collection<Review>

export const getReviewCollection = (): Collection<Review> => {
    if (!reviewCollection) {
        const db: Db = getDB()
        reviewCollection = db.collection<Review>('reviews')
        
        // Create indexes for performance
        reviewCollection.createIndex({ userId: 1, eventId: 1 }, { unique: true })
        reviewCollection.createIndex({ eventId: 1 })
        reviewCollection.createIndex({ userId: 1 })
    }
    
    return reviewCollection
}