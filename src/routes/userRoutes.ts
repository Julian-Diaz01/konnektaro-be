import {Request, Response, Router} from 'express'
import {getUserCollection} from '../collections/userCollection'
import {createUser, User} from '../models/user'

const router = Router()
console.log("🐱 Initializing /user routes")

// Create User
router.post('/', async (req: Request, res: Response) => {
    const { name, icon, description, sessionId, email } = req.body

    if (!name || !icon || !description || !sessionId || !email) {
        return res.status(400).json({ error: 'Missing required fields' })
    }

    const user = createUser({
        name, icon, description, sessionId, email,
        role: 'user'
    })

    const collection = getUserCollection()
    await collection.insertOne(user)

    res.status(201).json(user)
})

// Read User
router.get('/:userId', async (req: Request, res: Response) => {
    const { userId } = req.params
    const collection = getUserCollection()
    const user = await collection.findOne({ userId })

    if (!user) return res.status(404).json({ error: 'User not found' })

    res.json(user)
})

// Update User
router.put('/:userId', async (req: Request, res: Response) => {
    const { userId } = req.params
    const { name, icon, description, sessionId, group } = req.body

    const collection = getUserCollection()
    const updatedUser: User | null = await collection.findOneAndUpdate(
        {userId},
        {$set: {name, icon, description, sessionId, group}},
        {returnDocument: 'after'}
    )

    if (!updatedUser) return res.status(404).json({ error: 'User not found' })

    res.json(updatedUser)
})

// Delete User
router.delete('/:userId', async (req: Request, res: Response) => {
    const { userId } = req.params
    const collection = getUserCollection()
    const result = await collection.deleteOne({ userId })

    if (result.deletedCount === 0) return res.status(404).json({ error: 'User not found' })

    res.json({ success: true })
})


export default router
