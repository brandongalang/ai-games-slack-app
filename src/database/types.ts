// Database type definitions

export interface User {
  user_id: number;
  slack_id: string;
  display_name?: string;
  total_xp: number;
  current_streak: number;
  badges: Badge[];
  season_rank?: number;
  notification_preferences: NotificationPreferences;
  created_at: string;
  updated_at: string;
}

export interface Season {
  season_id: number;
  season_number: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'paused' | 'ended';
  decay_factor: number;
  created_at: string;
}

export interface Submission {
  submission_id: number;
  author_id: number;
  title?: string;
  prompt_text: string;
  description?: string;
  output_sample?: string;
  output_url?: string;
  tags: string[];
  submission_type: 'workflow' | 'challenge_response' | 'remix';
  parent_submission_id?: number;
  clarity_score?: number;
  llm_similarity_score?: number;
  is_promoted_to_library: boolean;
  season_id?: number;
  created_at: string;
  updated_at: string;
}

export interface XPEvent {
  event_id: number;
  user_id: number;
  submission_id?: number;
  event_type: string;
  xp_value: number;
  metadata: Record<string, any>;
  season_id?: number;
  created_at: string;
}

export interface Reaction {
  reaction_id: number;
  submission_id: number;
  reactor_id: number;
  reaction_type: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface SeedPrompt {
  seed_prompt_id: number;
  season_id: number;
  week_number: number;
  prompt_text: string;
  instructions?: string;
  is_active: boolean;
  created_at: string;
}

export interface Comment {
  comment_id: number;
  submission_id: number;
  author_id: number;
  comment_text: string;
  is_helpful?: boolean;
  parent_comment_id?: number;
  created_at: string;
  updated_at: string;
}

export interface UserStreak {
  streak_id: number;
  user_id: number;
  streak_date: string;
  activity_type: 'submission' | 'comment' | 'reaction';
  metadata: Record<string, any>;
  created_at: string;
}

// Supporting types
export interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  earned_at: string;
  category?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  xp_bonus?: number;
}

// Badge achievement criteria
export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  criteria: BadgeCriteria;
  xp_bonus: number;
  is_hidden: boolean; // Hidden until unlocked
  prerequisites?: string[]; // Other badge IDs required
}

export interface BadgeCriteria {
  type: 'xp_total' | 'submissions_count' | 'streak_days' | 'quality_average' | 'library_favorites' | 'comments_helpful' | 'special';
  threshold?: number;
  timeframe?: 'all_time' | 'season' | 'week' | 'month';
  special_condition?: string;
}

// Badge progress tracking
export interface BadgeProgress {
  badge_id: string;
  user_id: number;
  current_progress: number;
  required_progress: number;
  is_completed: boolean;
  last_updated: string;
}

export interface NotificationPreferences {
  streak_dms: boolean;
  weekly_digest: boolean;
}

export interface SecurityLog {
  log_id: number;
  user_id?: number;
  slack_user_id?: string;
  event_type: 'rate_limit_exceeded' | 'suspicious_behavior' | 'validation_failed' | 'content_blocked' | 'admin_action';
  description: string;
  risk_level: 'low' | 'medium' | 'high';
  metadata: Record<string, any>;
  created_at: string;
}

// XP Event Types (constants)
export const XP_EVENTS = {
  SUBMISSION_BASE: 'submission_base',
  CLARITY_BONUS: 'clarity_bonus',
  CLARITY_PENALTY: 'clarity_penalty',
  FIRST_SUBMISSION_BONUS: 'first_submission_bonus',
  WEEKLY_CHALLENGE_BONUS: 'weekly_challenge_bonus',
  HELPFUL_COMMENT: 'helpful_comment',
  RECEIVING_HELPFUL_REACTION: 'receiving_helpful_reaction',
  GIVING_HELPFUL_REACTION: 'giving_helpful_reaction',
  STREAK_MILESTONE_3: 'streak_milestone_3',
  STREAK_MILESTONE_7: 'streak_milestone_7',
  STREAK_MILESTONE_30: 'streak_milestone_30',
  STREAK_BONUS: 'streak_bonus',
  REMIX_ORIGINAL: 'remix_original',
  REMIX_IMPROVED: 'remix_improved'
} as const;

export const XP_VALUES = {
  [XP_EVENTS.SUBMISSION_BASE]: 10,
  [XP_EVENTS.CLARITY_BONUS]: 5,
  [XP_EVENTS.CLARITY_PENALTY]: -3, // Penalty for poor clarity
  [XP_EVENTS.FIRST_SUBMISSION_BONUS]: 5,
  [XP_EVENTS.WEEKLY_CHALLENGE_BONUS]: 10,
  [XP_EVENTS.HELPFUL_COMMENT]: 3,
  [XP_EVENTS.RECEIVING_HELPFUL_REACTION]: 2,
  [XP_EVENTS.GIVING_HELPFUL_REACTION]: 1,
  [XP_EVENTS.STREAK_MILESTONE_3]: 5,
  [XP_EVENTS.STREAK_MILESTONE_7]: 10,
  [XP_EVENTS.STREAK_MILESTONE_30]: 25,
  [XP_EVENTS.STREAK_BONUS]: 0, // Dynamic value calculated by StreakService
  [XP_EVENTS.REMIX_ORIGINAL]: 8,
  [XP_EVENTS.REMIX_IMPROVED]: 12
} as const;

// Prompt Library Types
export interface PromptCollection {
  collection_id: number;
  name: string;
  description?: string;
  creator_id: number;
  is_public: boolean;
  is_featured: boolean;
  is_system_collection: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PromptLibraryItem {
  library_item_id: number;
  submission_id: number;
  title: string;
  description?: string;
  category: string;
  subcategory?: string;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  estimated_time_minutes?: number;
  use_case_tags: string[];
  quality_score?: number;
  usage_count: number;
  curator_notes?: string;
  is_featured: boolean;
  is_verified: boolean;
  promoted_by?: number;
  promoted_at: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  submission?: Submission;
  author?: User;
  promoter?: User;
  is_favorited?: boolean;
}

export interface CollectionItem {
  collection_id: number;
  library_item_id: number;
  added_by?: number;
  added_at: string;
  display_order: number;
}

export interface UserFavorite {
  user_id: number;
  library_item_id: number;
  created_at: string;
}

export interface LibraryUsageAnalytics {
  usage_id: number;
  library_item_id: number;
  user_id?: number;
  action_type: 'view' | 'copy' | 'favorite' | 'share' | 'remix';
  source: string;
  metadata: Record<string, any>;
  created_at: string;
}

// Library search and filter types
export interface LibrarySearchFilters {
  query?: string;
  category?: string;
  subcategory?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
  featured?: boolean;
  verified?: boolean;
  minQuality?: number;
  sortBy?: 'quality' | 'usage' | 'recent' | 'alphabetical';
  sortOrder?: 'asc' | 'desc';
}

export interface LibrarySearchResult {
  items: PromptLibraryItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Collection with items
export interface CollectionWithItems extends PromptCollection {
  items: PromptLibraryItem[];
  item_count: number;
}