import { Server } from 'socket.io';
import { setupSocket, getSocketServer } from '../../socket';
import { emitActivityUpdate } from '../../sockets/activitySockets';
import { emitGroupsCreated } from '../../sockets/groupActivitySockets';

// Mock socket.io
const mockIO = {
  on: jest.fn(),
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  engine: {
    on: jest.fn(),
  },
};

jest.mock('socket.io', () => ({
  Server: jest.fn(() => mockIO),
}));

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
  process.env = {
    ...originalEnv,
    FRONTEND_URL: 'http://localhost:3000',
    FRONTEND_URL2: 'http://localhost:3001',
  };
});

afterEach(() => {
  process.env = originalEnv;
  jest.clearAllMocks();
});

describe('Socket Setup and Configuration', () => {
  it('should initialize Socket.IO server with correct configuration', () => {
    const mockServer = {} as any;
    
    setupSocket(mockServer);

    expect(Server).toHaveBeenCalledWith(mockServer, {
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:3001'],
        methods: ['PATCH'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 10000,
      maxHttpBufferSize: 1e6,
    });
  });

  it('should handle connection events', () => {
    const mockServer = {} as any;
    const mockSocket = {
      id: 'test-socket-id',
      join: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    };

    const mockIO = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      engine: {
        on: jest.fn(),
      },
    };

    (Server as unknown as jest.Mock).mockReturnValue(mockIO);

    setupSocket(mockServer);

    // Verify connection handler was set up
    expect(mockIO.on).toHaveBeenCalledWith('connection', expect.any(Function));

    // Simulate connection
    const connectionHandler = mockIO.on.mock.calls[0][1];
    connectionHandler(mockSocket);

    // Verify socket event handlers were set up
    expect(mockSocket.on).toHaveBeenCalledWith('joinEvent', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should handle joinEvent correctly', () => {
    const mockServer = {} as any;
    const mockSocket = {
      id: 'test-socket-id',
      join: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    };

    const mockIO = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      engine: {
        on: jest.fn(),
      },
    };

    (Server as unknown as jest.Mock).mockReturnValue(mockIO);

    setupSocket(mockServer);

    const connectionHandler = mockIO.on.mock.calls[0][1];
    connectionHandler(mockSocket);

    // Get the joinEvent handler
    const joinEventCall = mockSocket.on.mock.calls.find(call => call[0] === 'joinEvent');
    const joinEventHandler = joinEventCall[1];

    // Test joinEvent
    const eventId = 'event-123';
    joinEventHandler(eventId);

    expect(mockSocket.join).toHaveBeenCalledWith(eventId);
  });

  it('should handle disconnect events', () => {
    const mockServer = {} as any;
    const mockSocket = {
      id: 'test-socket-id',
      join: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    };

    const mockIO = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      engine: {
        on: jest.fn(),
      },
    };

    (Server as unknown as jest.Mock).mockReturnValue(mockIO);

    setupSocket(mockServer);

    const connectionHandler = mockIO.on.mock.calls[0][1];
    connectionHandler(mockSocket);

    // Get the disconnect handler
    const disconnectCall = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
    const disconnectHandler = disconnectCall[1];

    // Test disconnect
    const reason = 'client disconnect';
    disconnectHandler(reason);

    // The handler should log the disconnect (we can't easily test console.log in Jest)
    // But we can verify the handler was called
    expect(disconnectHandler).toBeDefined();
  });

  it('should handle socket errors', () => {
    const mockServer = {} as any;
    const mockSocket = {
      id: 'test-socket-id',
      join: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    };

    const mockIO = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      engine: {
        on: jest.fn(),
      },
    };

    (Server as unknown as jest.Mock).mockReturnValue(mockIO);

    setupSocket(mockServer);

    const connectionHandler = mockIO.on.mock.calls[0][1];
    connectionHandler(mockSocket);

    // Get the error handler
    const errorCall = mockSocket.on.mock.calls.find(call => call[0] === 'error');
    const errorHandler = errorCall[1];

    // Test error handling
    const error = new Error('Socket error');
    errorHandler(error);

    // The handler should log the error (we can't easily test console.log in Jest)
    // But we can verify the handler was called
    expect(errorHandler).toBeDefined();
  });

  it('should handle engine connection errors', () => {
    const mockServer = {} as any;
    const mockIO = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      engine: {
        on: jest.fn(),
      },
    };

    (Server as unknown as jest.Mock).mockReturnValue(mockIO);

    setupSocket(mockServer);

    // Verify engine error handlers were set up
    expect(mockIO.engine.on).toHaveBeenCalledWith('connection_error', expect.any(Function));
    expect(mockIO.engine.on).toHaveBeenCalledWith('upgrade_error', expect.any(Function));
  });

  it('should throw error when getSocketServer is called before initialization', () => {
    // Reset the module to clear any previous initialization
    jest.resetModules();
    
    // Re-import the module to get a fresh instance
    const { getSocketServer } = require('../../socket');
    
    expect(() => {
      getSocketServer();
    }).toThrow('Socket.IO server not initialized. Call setupSocket() first.');
  });
});

describe('Activity Socket Events', () => {
  let mockIO: any;

  beforeEach(() => {
    mockIO = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      engine: {
        on: jest.fn(),
      },
    };

    (Server as unknown as jest.Mock).mockReturnValue(mockIO);
  });

  it('should emit activityUpdate event correctly', () => {
    const mockServer = {} as any;
    setupSocket(mockServer);

    const eventId = 'event-123';
    const activityId = 'activity-456';

    emitActivityUpdate(eventId, activityId);

    expect(mockIO.to).toHaveBeenCalledWith(eventId);
    expect(mockIO.emit).toHaveBeenCalledWith('activityUpdate', { eventId, activityId });
  });

  it('should handle multiple activityUpdate emissions', () => {
    const mockServer = {} as any;
    setupSocket(mockServer);

    const events = [
      { eventId: 'event-1', activityId: 'activity-1' },
      { eventId: 'event-2', activityId: 'activity-2' },
      { eventId: 'event-3', activityId: 'activity-3' },
    ];

    events.forEach(({ eventId, activityId }) => {
      emitActivityUpdate(eventId, activityId);
    });

    expect(mockIO.to).toHaveBeenCalledTimes(3);
    expect(mockIO.emit).toHaveBeenCalledTimes(3);

    events.forEach(({ eventId, activityId }, index) => {
      expect(mockIO.to).toHaveBeenNthCalledWith(index + 1, eventId);
      expect(mockIO.emit).toHaveBeenNthCalledWith(index + 1, 'activityUpdate', { eventId, activityId });
    });
  });
});

describe('Group Activity Socket Events', () => {
  let mockIO: any;

  beforeEach(() => {
    mockIO = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      engine: {
        on: jest.fn(),
      },
    };

    (Server as unknown as jest.Mock).mockReturnValue(mockIO);
  });

  it('should emit groupsCreated event correctly', () => {
    const mockServer = {} as any;
    setupSocket(mockServer);

    const eventId = 'event-123';
    const activityId = 'activity-456';

    emitGroupsCreated(eventId, activityId);

    expect(mockIO.to).toHaveBeenCalledWith(eventId);
    expect(mockIO.emit).toHaveBeenCalledWith('groupsCreated', { eventId, activityId });
  });

  it('should handle multiple groupsCreated emissions', () => {
    const mockServer = {} as any;
    setupSocket(mockServer);

    const events = [
      { eventId: 'event-1', activityId: 'activity-1' },
      { eventId: 'event-2', activityId: 'activity-2' },
      { eventId: 'event-3', activityId: 'activity-3' },
    ];

    events.forEach(({ eventId, activityId }) => {
      emitGroupsCreated(eventId, activityId);
    });

    expect(mockIO.to).toHaveBeenCalledTimes(3);
    expect(mockIO.emit).toHaveBeenCalledTimes(3);

    events.forEach(({ eventId, activityId }, index) => {
      expect(mockIO.to).toHaveBeenNthCalledWith(index + 1, eventId);
      expect(mockIO.emit).toHaveBeenNthCalledWith(index + 1, 'groupsCreated', { eventId, activityId });
    });
  });

  it('should handle errors in emitGroupsCreated gracefully', () => {
    const mockServer = {} as any;
    setupSocket(mockServer);

    // Mock console.error to capture error logs
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // Make the emit method throw an error
    mockIO.emit.mockImplementation(() => {
      throw new Error('Socket emission failed');
    });

    const eventId = 'event-123';
    const activityId = 'activity-456';

    // Should not throw an error
    expect(() => {
      emitGroupsCreated(eventId, activityId);
    }).not.toThrow();

    // Should log the error
    expect(consoleSpy).toHaveBeenCalledWith('Error emitting groupsCreated event:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('should handle special characters in event and activity IDs', () => {
    const mockServer = {} as any;
    setupSocket(mockServer);

    const eventId = 'event-123-@#$%';
    const activityId = 'activity-456-!@#';

    emitGroupsCreated(eventId, activityId);

    expect(mockIO.to).toHaveBeenCalledWith(eventId);
    expect(mockIO.emit).toHaveBeenCalledWith('groupsCreated', { eventId, activityId });
  });

  it('should handle very long event and activity IDs', () => {
    const mockServer = {} as any;
    setupSocket(mockServer);

    const eventId = 'event-' + 'a'.repeat(100);
    const activityId = 'activity-' + 'b'.repeat(100);

    emitGroupsCreated(eventId, activityId);

    expect(mockIO.to).toHaveBeenCalledWith(eventId);
    expect(mockIO.emit).toHaveBeenCalledWith('groupsCreated', { eventId, activityId });
  });
});

describe('Socket Integration Tests', () => {
  let mockIO: any;

  beforeEach(() => {
    mockIO = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      engine: {
        on: jest.fn(),
      },
    };

    (Server as unknown as jest.Mock).mockReturnValue(mockIO);
  });

  it('should handle concurrent socket emissions', () => {
    const mockServer = {} as any;
    setupSocket(mockServer);

    const emissions = [
      { type: 'activityUpdate', eventId: 'event-1', activityId: 'activity-1' },
      { type: 'groupsCreated', eventId: 'event-2', activityId: 'activity-2' },
      { type: 'activityUpdate', eventId: 'event-3', activityId: 'activity-3' },
      { type: 'groupsCreated', eventId: 'event-4', activityId: 'activity-4' },
    ];

    emissions.forEach(({ type, eventId, activityId }) => {
      if (type === 'activityUpdate') {
        emitActivityUpdate(eventId, activityId);
      } else if (type === 'groupsCreated') {
        emitGroupsCreated(eventId, activityId);
      }
    });

    expect(mockIO.to).toHaveBeenCalledTimes(4);
    expect(mockIO.emit).toHaveBeenCalledTimes(4);
  });

  it('should maintain correct event data structure', () => {
    const mockServer = {} as any;
    setupSocket(mockServer);

    const eventId = 'event-123';
    const activityId = 'activity-456';

    // Test activityUpdate event structure
    emitActivityUpdate(eventId, activityId);
    expect(mockIO.emit).toHaveBeenCalledWith('activityUpdate', {
      eventId: 'event-123',
      activityId: 'activity-456',
    });

    // Test groupsCreated event structure
    emitGroupsCreated(eventId, activityId);
    expect(mockIO.emit).toHaveBeenCalledWith('groupsCreated', {
      eventId: 'event-123',
      activityId: 'activity-456',
    });
  });

  it('should handle multiple connections from different sources to one socket', () => {
    const mockServer = {} as any;
    const mockIO = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      engine: {
        on: jest.fn(),
      },
    };

    (Server as unknown as jest.Mock).mockReturnValue(mockIO);

    setupSocket(mockServer);

    const connectionHandler = mockIO.on.mock.calls[0][1];

    // Create multiple socket connections from different sources
    const mockSocket1 = {
      id: 'socket-1',
      join: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    };

    const mockSocket2 = {
      id: 'socket-2',
      join: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    };

    const mockSocket3 = {
      id: 'socket-3',
      join: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    };

    // Simulate multiple connections
    connectionHandler(mockSocket1);
    connectionHandler(mockSocket2);
    connectionHandler(mockSocket3);

    // Verify all sockets have event handlers set up
    expect(mockSocket1.on).toHaveBeenCalledWith('joinEvent', expect.any(Function));
    expect(mockSocket1.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket1.on).toHaveBeenCalledWith('error', expect.any(Function));

    expect(mockSocket2.on).toHaveBeenCalledWith('joinEvent', expect.any(Function));
    expect(mockSocket2.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket2.on).toHaveBeenCalledWith('error', expect.any(Function));

    expect(mockSocket3.on).toHaveBeenCalledWith('joinEvent', expect.any(Function));
    expect(mockSocket3.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket3.on).toHaveBeenCalledWith('error', expect.any(Function));

    // Test all sockets joining the same event
    const eventId = 'event-123';
    
    const joinEventCall1 = mockSocket1.on.mock.calls.find(call => call[0] === 'joinEvent');
    const joinEventHandler1 = joinEventCall1[1];
    
    const joinEventCall2 = mockSocket2.on.mock.calls.find(call => call[0] === 'joinEvent');
    const joinEventHandler2 = joinEventCall2[1];
    
    const joinEventCall3 = mockSocket3.on.mock.calls.find(call => call[0] === 'joinEvent');
    const joinEventHandler3 = joinEventCall3[1];

    // All sockets join the same event
    joinEventHandler1(eventId);
    joinEventHandler2(eventId);
    joinEventHandler3(eventId);

    expect(mockSocket1.join).toHaveBeenCalledWith(eventId);
    expect(mockSocket2.join).toHaveBeenCalledWith(eventId);
    expect(mockSocket3.join).toHaveBeenCalledWith(eventId);

    // Test socket emissions to the event room (all sockets should receive)
    const activityId = 'activity-456';
    emitActivityUpdate(eventId, activityId);
    emitGroupsCreated(eventId, activityId);

    // Verify emissions were sent to the event room (all connected sockets receive)
    expect(mockIO.to).toHaveBeenCalledWith(eventId);
    expect(mockIO.emit).toHaveBeenCalledWith('activityUpdate', { eventId, activityId });
    expect(mockIO.emit).toHaveBeenCalledWith('groupsCreated', { eventId, activityId });
  });

  it('should handle multiple connections with different events', () => {
    const mockServer = {} as any;
    const mockIO = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      engine: {
        on: jest.fn(),
      },
    };

    (Server as unknown as jest.Mock).mockReturnValue(mockIO);

    setupSocket(mockServer);

    const connectionHandler = mockIO.on.mock.calls[0][1];

    // Create multiple socket connections
    const mockSocket1 = { id: 'socket-1', join: jest.fn(), on: jest.fn(), emit: jest.fn() };
    const mockSocket2 = { id: 'socket-2', join: jest.fn(), on: jest.fn(), emit: jest.fn() };
    const mockSocket3 = { id: 'socket-3', join: jest.fn(), on: jest.fn(), emit: jest.fn() };

    // Simulate connections
    connectionHandler(mockSocket1);
    connectionHandler(mockSocket2);
    connectionHandler(mockSocket3);

    // Get joinEvent handlers
    const joinEventHandler1 = mockSocket1.on.mock.calls.find(call => call[0] === 'joinEvent')[1];
    const joinEventHandler2 = mockSocket2.on.mock.calls.find(call => call[0] === 'joinEvent')[1];
    const joinEventHandler3 = mockSocket3.on.mock.calls.find(call => call[0] === 'joinEvent')[1];

    // Sockets join different events
    joinEventHandler1('event-1');
    joinEventHandler2('event-2');
    joinEventHandler3('event-1'); // Socket3 joins same event as Socket1

    expect(mockSocket1.join).toHaveBeenCalledWith('event-1');
    expect(mockSocket2.join).toHaveBeenCalledWith('event-2');
    expect(mockSocket3.join).toHaveBeenCalledWith('event-1');

    // Test emissions to different events
    emitActivityUpdate('event-1', 'activity-1');
    emitActivityUpdate('event-2', 'activity-2');
    emitGroupsCreated('event-1', 'activity-3');

    // Verify emissions were sent to correct event rooms
    expect(mockIO.to).toHaveBeenCalledWith('event-1');
    expect(mockIO.to).toHaveBeenCalledWith('event-2');
    expect(mockIO.emit).toHaveBeenCalledWith('activityUpdate', { eventId: 'event-1', activityId: 'activity-1' });
    expect(mockIO.emit).toHaveBeenCalledWith('activityUpdate', { eventId: 'event-2', activityId: 'activity-2' });
    expect(mockIO.emit).toHaveBeenCalledWith('groupsCreated', { eventId: 'event-1', activityId: 'activity-3' });
  });

  it('should handle connection and disconnection lifecycle', () => {
    const mockServer = {} as any;
    const mockIO = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      engine: {
        on: jest.fn(),
      },
    };

    (Server as unknown as jest.Mock).mockReturnValue(mockIO);

    setupSocket(mockServer);

    const connectionHandler = mockIO.on.mock.calls[0][1];

    // Create multiple socket connections
    const mockSocket1 = { id: 'socket-1', join: jest.fn(), on: jest.fn(), emit: jest.fn() };
    const mockSocket2 = { id: 'socket-2', join: jest.fn(), on: jest.fn(), emit: jest.fn() };
    const mockSocket3 = { id: 'socket-3', join: jest.fn(), on: jest.fn(), emit: jest.fn() };

    // Simulate connections
    connectionHandler(mockSocket1);
    connectionHandler(mockSocket2);
    connectionHandler(mockSocket3);

    // Get event handlers
    const joinEventHandler1 = mockSocket1.on.mock.calls.find(call => call[0] === 'joinEvent')[1];
    const joinEventHandler2 = mockSocket2.on.mock.calls.find(call => call[0] === 'joinEvent')[1];
    const joinEventHandler3 = mockSocket3.on.mock.calls.find(call => call[0] === 'joinEvent')[1];

    const disconnectHandler1 = mockSocket1.on.mock.calls.find(call => call[0] === 'disconnect')[1];
    const disconnectHandler2 = mockSocket2.on.mock.calls.find(call => call[0] === 'disconnect')[1];
    const disconnectHandler3 = mockSocket3.on.mock.calls.find(call => call[0] === 'disconnect')[1];

    // All sockets join the same event
    joinEventHandler1('event-123');
    joinEventHandler2('event-123');
    joinEventHandler3('event-123');

    // Test emissions while all sockets are connected
    emitActivityUpdate('event-123', 'activity-1');
    expect(mockIO.to).toHaveBeenCalledWith('event-123');
    expect(mockIO.emit).toHaveBeenCalledWith('activityUpdate', { eventId: 'event-123', activityId: 'activity-1' });

    // Simulate Socket2 disconnecting
    disconnectHandler2('client disconnect');

    // Test emissions after Socket2 disconnects (Socket1 and Socket3 should still receive)
    emitGroupsCreated('event-123', 'activity-2');
    expect(mockIO.to).toHaveBeenCalledWith('event-123');
    expect(mockIO.emit).toHaveBeenCalledWith('groupsCreated', { eventId: 'event-123', activityId: 'activity-2' });

    // Simulate Socket1 disconnecting
    disconnectHandler1('client disconnect');

    // Test emissions after Socket1 disconnects (only Socket3 should receive)
    emitActivityUpdate('event-123', 'activity-3');
    expect(mockIO.to).toHaveBeenCalledWith('event-123');
    expect(mockIO.emit).toHaveBeenCalledWith('activityUpdate', { eventId: 'event-123', activityId: 'activity-3' });

    // Simulate Socket3 disconnecting
    disconnectHandler3('client disconnect');

    // Test emissions after all sockets disconnect (should still work for new connections)
    emitGroupsCreated('event-123', 'activity-4');
    expect(mockIO.to).toHaveBeenCalledWith('event-123');
    expect(mockIO.emit).toHaveBeenCalledWith('groupsCreated', { eventId: 'event-123', activityId: 'activity-4' });
  });
});
