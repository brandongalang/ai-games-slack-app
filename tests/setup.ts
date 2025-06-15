/**
 * Jest test setup file
 * Configures global test environment and mocks
 */

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';
process.env.SLACK_APP_TOKEN = 'xapp-test-token';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.ADMIN_USERS = 'U12345,U67890';

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

beforeAll(() => {
  // Suppress console output during tests unless explicitly enabled
  if (!process.env.ENABLE_TEST_LOGS) {
    console.error = jest.fn();
    console.warn = jest.fn();
    console.log = jest.fn();
  }
});

afterAll(() => {
  // Restore console methods
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
});

// Global test helpers
(global as any).mockSlackUser = {
  id: 'U12345',
  name: 'test.user',
  real_name: 'Test User',
  email: 'test@example.com'
};

(global as any).mockSubmission = {
  submission_id: 1,
  author_id: 1,
  title: 'Test Submission',
  prompt_text: 'This is a test prompt',
  description: 'Test description',
  output_sample: 'Test output',
  tags: ['test', 'example'],
  submission_type: 'workflow' as const,
  clarity_score: 8.5,
  is_promoted_to_library: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

(global as any).mockUser = {
  user_id: 1,
  slack_id: 'U12345',
  display_name: 'Test User',
  total_xp: 100,
  current_streak: 3,
  badges: [],
  notification_preferences: {
    streak_dms: true,
    weekly_digest: true
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};