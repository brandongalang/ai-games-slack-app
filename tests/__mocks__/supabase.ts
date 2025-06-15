/**
 * Mock Supabase client for testing
 */

export const mockSupabaseResponse = {
  data: null,
  error: null,
  status: 200,
  statusText: 'OK'
};

export const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve(mockSupabaseResponse)),
        limit: jest.fn(() => Promise.resolve(mockSupabaseResponse)),
        order: jest.fn(() => Promise.resolve(mockSupabaseResponse)),
        gte: jest.fn(() => Promise.resolve(mockSupabaseResponse)),
        lte: jest.fn(() => Promise.resolve(mockSupabaseResponse)),
        in: jest.fn(() => Promise.resolve(mockSupabaseResponse)),
        ilike: jest.fn(() => Promise.resolve(mockSupabaseResponse)),
      })),
      limit: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve(mockSupabaseResponse))
      })),
      order: jest.fn(() => Promise.resolve(mockSupabaseResponse)),
      gte: jest.fn(() => Promise.resolve(mockSupabaseResponse)),
      lte: jest.fn(() => Promise.resolve(mockSupabaseResponse))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => Promise.resolve(mockSupabaseResponse))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => Promise.resolve(mockSupabaseResponse))
      }))
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve(mockSupabaseResponse))
    })),
    upsert: jest.fn(() => ({
      select: jest.fn(() => Promise.resolve(mockSupabaseResponse))
    }))
  }))
};

// Mock the Supabase module
jest.mock('../../src/database/supabase', () => ({
  supabaseAdmin: mockSupabaseClient
}));