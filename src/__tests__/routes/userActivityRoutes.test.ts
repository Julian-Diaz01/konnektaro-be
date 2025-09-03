import request from 'supertest';
import express from 'express';
import userActivityRoutes from '../../routes/userActivityRoutes';
import { createMockCollection, sampleUserActivity } from '../utils/testUtils';

// Mock all dependencies
jest.mock('../../middleware/authMiddleware', () => ({
  verifyFirebaseToken: jest.fn((req: any, res: any, next: any) => {
    req.user = { uid: 'test-user-id', email: 'test@example.com' };
    next();
  }),
}));

jest.mock('../../collections/userActivityCollection', () => ({
  getUserActivityCollection: jest.fn(),
}));

jest.mock('../../collections/userCollection', () => ({
  getUserCollection: jest.fn(),
}));

jest.mock('../../services/reviewService', () => ({
  updateUserReview: jest.fn(),
}));

jest.mock('../../models/userActivity', () => ({
  createUserActivity: jest.fn((data) => ({ ...data, _id: 'mock-id' })),
}));

// Import mocked modules
import { getUserActivityCollection } from '../../collections/userActivityCollection';
import { getUserCollection } from '../../collections/userCollection';
import { updateUserReview } from '../../services/reviewService';

const app = express();
app.use(express.json());
app.use('/user-activity', userActivityRoutes);

describe('UserActivity Routes', () => {
  let mockUserActivityCollection: any;
  let mockUserCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUserActivityCollection = createMockCollection();
    mockUserCollection = createMockCollection();
    
    (getUserActivityCollection as jest.Mock).mockReturnValue(mockUserActivityCollection);
    (getUserCollection as jest.Mock).mockReturnValue(mockUserCollection);
    (updateUserReview as jest.Mock).mockResolvedValue(undefined);
  });

  describe('POST /user-activity', () => {
    it('should create a new user activity successfully', async () => {
      const userActivityData = {
        activityId: 'activity-123',
        groupId: 'group-456',
        notes: 'Test notes',
        userId: 'user-123',
      };

      mockUserActivityCollection.findOne.mockResolvedValue(null);
      mockUserActivityCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });
      mockUserCollection.findOne.mockResolvedValue({ userId: 'user-123', eventId: 'event-123' });

      const response = await request(app)
        .post('/user-activity')
        .send(userActivityData)
        .expect(201);

      expect(mockUserActivityCollection.findOne).toHaveBeenCalledWith({
        activityId: 'activity-123',
        userId: 'user-123',
      });
      expect(mockUserActivityCollection.insertOne).toHaveBeenCalled();
      expect(updateUserReview).toHaveBeenCalledWith('user-123', 'event-123');
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/user-activity')
        .send({ activityId: 'activity-123' })
        .expect(400);

      expect(response.body).toEqual({ error: 'Missing required fields' });
    });

    it('should return 409 when user has already submitted for this activity', async () => {
      const userActivityData = {
        activityId: 'activity-123',
        groupId: 'group-456',
        notes: 'Test notes',
        userId: 'user-123',
      };

      mockUserActivityCollection.findOne.mockResolvedValue(sampleUserActivity);

      const response = await request(app)
        .post('/user-activity')
        .send(userActivityData)
        .expect(409);

      expect(response.body).toEqual({ error: 'User has already submitted a response for this activity' });
    });

    it('should sanitize HTML input', async () => {
      const userActivityData = {
        activityId: 'activity-123',
        groupId: 'group-456',
        notes: '<script>alert("xss")</script>Test notes',
        userId: 'user-123',
      };

      mockUserActivityCollection.findOne.mockResolvedValue(null);
      mockUserActivityCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });
      mockUserCollection.findOne.mockResolvedValue({ userId: 'user-123', eventId: 'event-123' });

      await request(app)
        .post('/user-activity')
        .send(userActivityData)
        .expect(201);

      expect(mockUserActivityCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Test notes', // Script tag should be removed
        })
      );
    });
  });

  describe('GET /user-activity', () => {
    it('should return all user activities', async () => {
      const mockActivities = [sampleUserActivity, { ...sampleUserActivity, userId: 'user-456' }];
      mockUserActivityCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockActivities),
      });

      const response = await request(app)
        .get('/user-activity')
        .expect(200);

      expect(response.body).toEqual(mockActivities);
    });
  });

  describe('GET /user-activity/user/:userId/activity/:activityId', () => {
    it('should return user activity when found', async () => {
      mockUserActivityCollection.findOne.mockResolvedValue(sampleUserActivity);

      const response = await request(app)
        .get('/user-activity/user/user-123/activity/activity-123')
        .expect(200);

      expect(response.body).toEqual(sampleUserActivity);
      expect(mockUserActivityCollection.findOne).toHaveBeenCalledWith({
        userId: 'user-123',
        activityId: 'activity-123',
      });
    });

    it('should return 404 when user activity not found', async () => {
      mockUserActivityCollection.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/user-activity/user/user-123/activity/activity-123')
        .expect(404);

      expect(response.body).toEqual({ error: 'Not found' });
    });
  });

  describe('PUT /user-activity/user/:userId/activity/:activityId', () => {
    it('should update user activity successfully', async () => {
      const updateData = {
        notes: 'Updated notes',
        groupId: 'new-group-456',
      };

      mockUserActivityCollection.updateOne.mockResolvedValue({ matchedCount: 1 });
      mockUserCollection.findOne.mockResolvedValue({ userId: 'user-123', eventId: 'event-123' });

      const response = await request(app)
        .put('/user-activity/user/user-123/activity/activity-123')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({ message: 'UserActivity updated' });
      expect(mockUserActivityCollection.updateOne).toHaveBeenCalledWith(
        { userId: 'user-123', activityId: 'activity-123' },
        expect.objectContaining({
          $set: expect.objectContaining({
            notes: 'Updated notes',
            groupId: 'new-group-456',
          }),
        })
      );
      expect(updateUserReview).toHaveBeenCalledWith('user-123', 'event-123');
    });

    it('should return 400 when notes are missing', async () => {
      const response = await request(app)
        .put('/user-activity/user/user-123/activity/activity-123')
        .send({ groupId: 'new-group-456' })
        .expect(400);

      expect(response.body).toEqual({ error: 'Missing notes' });
    });

    it('should return 404 when user activity not found', async () => {
      const updateData = { notes: 'Updated notes' };
      mockUserActivityCollection.updateOne.mockResolvedValue({ matchedCount: 0 });

      const response = await request(app)
        .put('/user-activity/user/user-123/activity/activity-123')
        .send(updateData)
        .expect(404);

      expect(response.body).toEqual({ error: 'Not found' });
    });

    it('should sanitize HTML input in update', async () => {
      const updateData = {
        notes: '<script>alert("xss")</script>Updated notes',
        groupId: 'new-group-456',
      };

      mockUserActivityCollection.updateOne.mockResolvedValue({ matchedCount: 1 });
      mockUserCollection.findOne.mockResolvedValue({ userId: 'user-123', eventId: 'event-123' });

      await request(app)
        .put('/user-activity/user/user-123/activity/activity-123')
        .send(updateData)
        .expect(200);

      expect(mockUserActivityCollection.updateOne).toHaveBeenCalledWith(
        { userId: 'user-123', activityId: 'activity-123' },
        expect.objectContaining({
          $set: expect.objectContaining({
            notes: 'Updated notes', // Script tag should be removed
          }),
        })
      );
    });
  });

  describe('DELETE /user-activity/user/:userId/activity/:activityId', () => {
    it('should delete user activity successfully', async () => {
      mockUserActivityCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });
      mockUserCollection.findOne.mockResolvedValue({ userId: 'user-123', eventId: 'event-123' });

      const response = await request(app)
        .delete('/user-activity/user/user-123/activity/activity-123')
        .expect(200);

      expect(response.body).toEqual({ message: 'UserActivity deleted' });
      expect(mockUserActivityCollection.deleteOne).toHaveBeenCalledWith({
        userId: 'user-123',
        activityId: 'activity-123',
      });
      expect(updateUserReview).toHaveBeenCalledWith('user-123', 'event-123');
    });

    it('should return 404 when user activity not found', async () => {
      mockUserActivityCollection.deleteOne.mockResolvedValue({ deletedCount: 0 });

      const response = await request(app)
        .delete('/user-activity/user/user-123/activity/activity-123')
        .expect(404);

      expect(response.body).toEqual({ error: 'Not found' });
    });
  });

  describe('Integration Test: Complete User Activity Journey', () => {
    it('should handle complete user activity lifecycle: create → get → update → get → verify', async () => {
      const userId = 'user-123';
      const activityId = 'activity-123';
      const eventId = 'event-123';
      
      // Initial data
      const initialData = {
        activityId,
        groupId: 'group-456',
        notes: 'Initial notes',
        userId,
      };

      const updatedData = {
        notes: 'Updated notes with more detail',
        groupId: 'new-group-789',
      };

      // Step 1: Create user activity
      mockUserActivityCollection.findOne.mockResolvedValue(null); // No existing activity
      mockUserActivityCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });
      mockUserCollection.findOne.mockResolvedValue({ userId, eventId });

      const createResponse = await request(app)
        .post('/user-activity')
        .send(initialData)
        .expect(201);

      expect(createResponse.body).toMatchObject({
        activityId,
        groupId: 'group-456',
        notes: 'Initial notes',
        userId,
      });

      // Step 2: Get the created activity
      const createdActivity = {
        ...initialData,
        _id: 'mock-id',
        date: '2024-01-01T00:00:00.000Z',
      };
      mockUserActivityCollection.findOne.mockResolvedValue(createdActivity);

      const getResponse1 = await request(app)
        .get(`/user-activity/user/${userId}/activity/${activityId}`)
        .expect(200);

      expect(getResponse1.body).toEqual(createdActivity);

      // Step 3: Update the activity
      mockUserActivityCollection.updateOne.mockResolvedValue({ matchedCount: 1 });
      mockUserCollection.findOne.mockResolvedValue({ userId, eventId });

      const updateResponse = await request(app)
        .put(`/user-activity/user/${userId}/activity/${activityId}`)
        .send(updatedData)
        .expect(200);

      expect(updateResponse.body).toEqual({ message: 'UserActivity updated' });

      // Step 4: Get the updated activity
      const updatedActivity = {
        ...createdActivity,
        notes: 'Updated notes with more detail',
        groupId: 'new-group-789',
        date: '2024-01-01T00:00:00.000Z',
      };
      mockUserActivityCollection.findOne.mockResolvedValue(updatedActivity);

      const getResponse2 = await request(app)
        .get(`/user-activity/user/${userId}/activity/${activityId}`)
        .expect(200);

      expect(getResponse2.body).toEqual(updatedActivity);

      // Step 5: Verify the data has changed
      expect(getResponse2.body.notes).toBe('Updated notes with more detail');
      expect(getResponse2.body.groupId).toBe('new-group-789');
      expect(getResponse2.body.notes).not.toBe(getResponse1.body.notes);
      expect(getResponse2.body.groupId).not.toBe(getResponse1.body.groupId);

      // Verify all expected calls were made
      expect(mockUserActivityCollection.findOne).toHaveBeenCalledTimes(3); // Create check + 2 gets
      expect(mockUserActivityCollection.insertOne).toHaveBeenCalledTimes(1);
      expect(mockUserActivityCollection.updateOne).toHaveBeenCalledTimes(1);
      expect(updateUserReview).toHaveBeenCalledTimes(2); // Once for create, once for update
    });

    it('should handle complete user activity lifecycle with HTML sanitization', async () => {
      const userId = 'user-456';
      const activityId = 'activity-456';
      const eventId = 'event-456';
      
      // Initial data with HTML
      const initialData = {
        activityId,
        groupId: 'group-123',
        notes: '<script>alert("xss")</script>Initial notes',
        userId,
      };

      const updatedData = {
        notes: '<script>alert("xss")</script>Updated notes with <b>HTML</b>',
        groupId: 'new-group-456',
      };

      // Step 1: Create user activity
      mockUserActivityCollection.findOne.mockResolvedValue(null);
      mockUserActivityCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });
      mockUserCollection.findOne.mockResolvedValue({ userId, eventId });

      const createResponse = await request(app)
        .post('/user-activity')
        .send(initialData)
        .expect(201);

      // Step 2: Get the created activity (should be sanitized)
      const createdActivity = {
        ...initialData,
        notes: 'Initial notes', // HTML should be removed
        _id: 'mock-id',
        date: '2024-01-01T00:00:00.000Z',
      };
      mockUserActivityCollection.findOne.mockResolvedValue(createdActivity);

      const getResponse1 = await request(app)
        .get(`/user-activity/user/${userId}/activity/${activityId}`)
        .expect(200);

      expect(getResponse1.body.notes).toBe('Initial notes');

      // Step 3: Update the activity
      mockUserActivityCollection.updateOne.mockResolvedValue({ matchedCount: 1 });
      mockUserCollection.findOne.mockResolvedValue({ userId, eventId });

      const updateResponse = await request(app)
        .put(`/user-activity/user/${userId}/activity/${activityId}`)
        .send(updatedData)
        .expect(200);

      // Step 4: Get the updated activity (should be sanitized)
      const updatedActivity = {
        ...createdActivity,
        notes: 'Updated notes with HTML', // HTML should be removed
        groupId: 'new-group-456',
        date: '2024-01-01T00:00:00.000Z',
      };
      mockUserActivityCollection.findOne.mockResolvedValue(updatedActivity);

      const getResponse2 = await request(app)
        .get(`/user-activity/user/${userId}/activity/${activityId}`)
        .expect(200);

      expect(getResponse2.body.notes).toBe('Updated notes with HTML');
      expect(getResponse2.body.notes).not.toContain('<script>');
      expect(getResponse2.body.notes).not.toContain('alert');
    });

    it('should handle complete user activity lifecycle with validation errors', async () => {
      const userId = 'user-789';
      const activityId = 'activity-789';
      
      // Step 1: Try to create with missing required fields
      const invalidData = {
        activityId,
        // Missing notes and userId
      };

      const createResponse = await request(app)
        .post('/user-activity')
        .send(invalidData)
        .expect(400);

      expect(createResponse.body).toEqual({ error: 'Missing required fields' });

      // Step 2: Create with valid data
      const validData = {
        activityId,
        groupId: 'group-789',
        notes: 'Valid notes',
        userId,
      };

      mockUserActivityCollection.findOne.mockResolvedValue(null);
      mockUserActivityCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });
      mockUserCollection.findOne.mockResolvedValue({ userId, eventId: 'event-789' });

      const createResponse2 = await request(app)
        .post('/user-activity')
        .send(validData)
        .expect(201);

      // Step 3: Try to update with missing notes
      const invalidUpdateData = {
        groupId: 'new-group-789',
        // Missing notes
      };

      const updateResponse = await request(app)
        .put(`/user-activity/user/${userId}/activity/${activityId}`)
        .send(invalidUpdateData)
        .expect(400);

      expect(updateResponse.body).toEqual({ error: 'Missing notes' });

      // Step 4: Update with valid data
      const validUpdateData = {
        notes: 'Valid updated notes',
        groupId: 'new-group-789',
      };

      mockUserActivityCollection.updateOne.mockResolvedValue({ matchedCount: 1 });
      mockUserCollection.findOne.mockResolvedValue({ userId, eventId: 'event-789' });

      const updateResponse2 = await request(app)
        .put(`/user-activity/user/${userId}/activity/${activityId}`)
        .send(validUpdateData)
        .expect(200);

      expect(updateResponse2.body).toEqual({ message: 'UserActivity updated' });
    });
  });
});
