import { MongoClient, ServerApiVersion, Db } from 'mongodb'

const uri = process.env.MONGO_URI as string

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
})

let db: Db

export const connectDB = async () => {
    try {
        await client.connect()
        db = client.db('konnektaro') // use your actual DB name
        await db.command({ ping: 1 })
        console.log('✅ MongoDB connected')
    } catch (err) {
        console.error('❌ MongoDB connection failed', err)
        process.exit(1)
    }
}

export const getDB = (): Db => {
    if (!db) throw new Error('❌ DB not initialized. Call connectDB first.')
    return db
}
