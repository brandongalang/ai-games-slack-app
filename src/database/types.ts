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
  llm_clarity_score?: number;
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
}

export interface NotificationPreferences {
  streak_dms: boolean;
  weekly_digest: boolean;
}

// XP Event Types (constants)
export const XP_EVENTS = {
  SUBMISSION_BASE: 'submission_base',
  CLARITY_BONUS: 'clarity_bonus',
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