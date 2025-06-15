import { supabaseAdmin } from '../database/supabase';
import { User, NotificationPreferences } from '../database/types';
import { UserService } from './userService';
import { BadgeService } from './badgeService';
import { XPService } from './xpService';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action?: string;
  emoji: string;
}

export interface OnboardingProgress {
  userId: number;
  steps: OnboardingStep[];
  currentStep: number;
  completedSteps: number;
  totalSteps: number;
  isComplete: boolean;
  startedAt: string;
  completedAt?: string;
}

export interface WelcomeData {
  user: User;
  isFirstTime: boolean;
  onboardingProgress: OnboardingProgress;
  quickStats: {
    totalUsers: number;
    activeSeasonUsers: number;
    currentSeasonNumber: number;
  };
}

export class OnboardingService {
  /**
   * Default onboarding steps for new users
   */
  private static readonly ONBOARDING_STEPS: Omit<OnboardingStep, 'completed'>[] = [
    {
      id: 'welcome',
      title: 'Welcome to AI Games!',
      description: 'Learn about the community and XP system',
      emoji: '👋',
      action: 'view_welcome'
    },
    {
      id: 'first_submission',
      title: 'Submit Your First Prompt',
      description: 'Use /submit to share your first AI workflow or prompt',
      emoji: '📝',
      action: 'submit_prompt'
    },
    {
      id: 'set_preferences',
      title: 'Set Notification Preferences',
      description: 'Choose how you want to be notified about your progress',
      emoji: '⚙️',
      action: 'set_preferences'
    },
    {
      id: 'join_community',
      title: 'Engage with Community',
      description: 'Comment on or react to other submissions',
      emoji: '🤝',
      action: 'community_engage'
    },
    {
      id: 'explore_library',
      title: 'Explore the Prompt Library',
      description: 'Browse featured prompts and collections',
      emoji: '📚',
      action: 'explore_library'
    }
  ];

  /**
   * Initialize onboarding for a new user
   */
  static async initializeOnboarding(slackUserId: string): Promise<OnboardingProgress | null> {
    try {
      // Get or create user
      const user = await UserService.getOrCreateUser(slackUserId);
      if (!user) {
        throw new Error('Failed to create user');
      }

      // Check if user already has onboarding progress
      const { data: existing } = await supabaseAdmin
        .from('user_onboarding')
        .select('*')
        .eq('user_id', user.user_id)
        .single();

      if (existing) {
        return this.getOnboardingProgress(user.user_id);
      }

      // Create new onboarding record
      const steps = this.ONBOARDING_STEPS.map(step => ({
        ...step,
        completed: false
      }));

      const onboardingData = {
        user_id: user.user_id,
        steps: steps,
        current_step: 0,
        completed_steps: 0,
        total_steps: steps.length,
        is_complete: false,
        started_at: new Date().toISOString()
      };

      const { error } = await supabaseAdmin
        .from('user_onboarding')
        .insert(onboardingData);

      if (error) {
        console.error('Error creating onboarding record:', error);
        return null;
      }

      // Award welcome bonus XP
      await XPService.awardXP({
        userId: user.user_id,
        eventType: 'FIRST_SUBMISSION_BONUS',
        xpValue: 5,
        metadata: {
          milestone: 'onboarding_started',
          step: 'welcome'
        }
      });

      console.log(`Initialized onboarding for user ${user.user_id} (${slackUserId})`);

      return {
        userId: user.user_id,
        steps,
        currentStep: 0,
        completedSteps: 0,
        totalSteps: steps.length,
        isComplete: false,
        startedAt: onboardingData.started_at
      };

    } catch (error) {
      console.error('Error initializing onboarding:', error);
      return null;
    }
  }

  /**
   * Get onboarding progress for a user
   */
  static async getOnboardingProgress(userId: number): Promise<OnboardingProgress | null> {
    try {
      const { data: onboarding } = await supabaseAdmin
        .from('user_onboarding')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!onboarding) {
        return null;
      }

      return {
        userId: onboarding.user_id,
        steps: onboarding.steps || [],
        currentStep: onboarding.current_step || 0,
        completedSteps: onboarding.completed_steps || 0,
        totalSteps: onboarding.total_steps || this.ONBOARDING_STEPS.length,
        isComplete: onboarding.is_complete || false,
        startedAt: onboarding.started_at,
        completedAt: onboarding.completed_at
      };

    } catch (error) {
      console.error('Error getting onboarding progress:', error);
      return null;
    }
  }

  /**
   * Complete an onboarding step
   */
  static async completeOnboardingStep(
    userId: number, 
    stepId: string,
    metadata: Record<string, any> = {}
  ): Promise<{ success: boolean; newBadges?: any[]; xpAwarded?: number }> {
    try {
      const progress = await this.getOnboardingProgress(userId);
      if (!progress || progress.isComplete) {
        return { success: false };
      }

      // Find and complete the step
      const stepIndex = progress.steps.findIndex(step => step.id === stepId);
      if (stepIndex === -1 || progress.steps[stepIndex].completed) {
        return { success: false };
      }

      // Update step as completed
      progress.steps[stepIndex].completed = true;
      progress.completedSteps++;

      // Check if onboarding is complete
      const isComplete = progress.completedSteps >= progress.totalSteps;
      let completedAt = undefined;

      if (isComplete) {
        completedAt = new Date().toISOString();
      }

      // Update database
      const { error } = await supabaseAdmin
        .from('user_onboarding')
        .update({
          steps: progress.steps,
          completed_steps: progress.completedSteps,
          current_step: isComplete ? progress.totalSteps : stepIndex + 1,
          is_complete: isComplete,
          completed_at: completedAt,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      // Award XP for step completion
      let xpAwarded = 0;
      const stepXpValues: Record<string, number> = {
        welcome: 5,
        first_submission: 15,
        set_preferences: 10,
        join_community: 10,
        explore_library: 5
      };

      if (stepXpValues[stepId]) {
        const xpResult = await XPService.awardXP({
          userId,
          eventType: 'SUBMISSION_BASE',
          xpValue: stepXpValues[stepId],
          metadata: {
            milestone: 'onboarding_step',
            step: stepId,
            ...metadata
          }
        });
        xpAwarded = xpResult.totalXP;
      }

      // Award completion badge if onboarding is complete
      let newBadges: any[] = [];
      if (isComplete) {
        const completionXp = await XPService.awardXP({
          userId,
          eventType: 'FIRST_SUBMISSION_BONUS',
          xpValue: 25,
          metadata: {
            milestone: 'onboarding_complete',
            completedSteps: progress.completedSteps
          }
        });
        xpAwarded += completionXp.totalXP;

        // Check for any new badges earned
        newBadges = await BadgeService.checkAndAwardBadges(userId);
      }

      console.log(`User ${userId} completed onboarding step: ${stepId}`, {
        completedSteps: progress.completedSteps,
        isComplete,
        xpAwarded
      });

      return { 
        success: true, 
        newBadges: newBadges.length > 0 ? newBadges : undefined,
        xpAwarded 
      };

    } catch (error) {
      console.error('Error completing onboarding step:', error);
      return { success: false };
    }
  }

  /**
   * Get welcome data for home tab
   */
  static async getWelcomeData(slackUserId: string): Promise<WelcomeData | null> {
    try {
      // Get or create user
      const user = await UserService.getOrCreateUser(slackUserId);
      if (!user) {
        return null;
      }

      // Check if this is first time (no submissions yet)
      const { data: submissions } = await supabaseAdmin
        .from('submissions')
        .select('submission_id')
        .eq('author_id', user.user_id)
        .limit(1);

      const isFirstTime = !submissions || submissions.length === 0;

      // Get or initialize onboarding progress
      let onboardingProgress = await this.getOnboardingProgress(user.user_id);
      if (!onboardingProgress) {
        onboardingProgress = await this.initializeOnboarding(slackUserId);
      }

      if (!onboardingProgress) {
        throw new Error('Failed to get onboarding progress');
      }

      // Get quick stats
      const [
        { count: totalUsers },
        { count: activeSeasonUsers },
        { data: currentSeason }
      ] = await Promise.all([
        supabaseAdmin
          .from('users')
          .select('*', { count: 'exact', head: true }),
        
        supabaseAdmin
          .from('xp_events')
          .select('user_id', { count: 'exact', head: true })
          .not('season_id', 'is', null)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        
        supabaseAdmin
          .from('seasons')
          .select('season_number')
          .eq('status', 'active')
          .single()
      ]);

      const quickStats = {
        totalUsers: totalUsers || 0,
        activeSeasonUsers: activeSeasonUsers || 0,
        currentSeasonNumber: currentSeason?.season_number || 1
      };

      return {
        user,
        isFirstTime,
        onboardingProgress,
        quickStats
      };

    } catch (error) {
      console.error('Error getting welcome data:', error);
      return null;
    }
  }

  /**
   * Update user notification preferences
   */
  static async updateNotificationPreferences(
    userId: number,
    preferences: Partial<NotificationPreferences>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current user preferences
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('notification_preferences')
        .eq('user_id', userId)
        .single();

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Merge with existing preferences
      const currentPrefs = user.notification_preferences || {
        streak_dms: true,
        weekly_digest: true
      };

      const updatedPrefs = {
        ...currentPrefs,
        ...preferences
      };

      // Update user preferences
      const { error } = await supabaseAdmin
        .from('users')
        .update({ 
          notification_preferences: updatedPrefs,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Complete onboarding step if this is during onboarding
      await this.completeOnboardingStep(userId, 'set_preferences', {
        preferences: updatedPrefs
      });

      console.log(`Updated notification preferences for user ${userId}:`, updatedPrefs);

      return { success: true };

    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return { success: false, error: 'Failed to update preferences' };
    }
  }

  /**
   * Format onboarding progress for Slack display
   */
  static formatOnboardingForSlack(progress: OnboardingProgress): any[] {
    const { steps, completedSteps, totalSteps, isComplete } = progress;
    
    const progressPercent = Math.round((completedSteps / totalSteps) * 100);
    const progressBar = '█'.repeat(Math.floor(progressPercent / 10)) + '░'.repeat(10 - Math.floor(progressPercent / 10));

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🎯 *Getting Started Progress*\n${progressBar} ${progressPercent}% (${completedSteps}/${totalSteps} completed)`
        }
      }
    ];

    if (!isComplete) {
      // Show next incomplete step
      const nextStep = steps.find(step => !step.completed);
      if (nextStep) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${nextStep.emoji} *Next: ${nextStep.title}*\n${nextStep.description}`
          }
        });

        // Add action button if available
        if (nextStep.action) {
          const actionButtons: Record<string, any> = {
            submit_prompt: {
              type: 'button',
              text: { type: 'plain_text', text: '📝 Submit Prompt' },
              action_id: 'submit_prompt',
              style: 'primary'
            },
            set_preferences: {
              type: 'button',
              text: { type: 'plain_text', text: '⚙️ Set Preferences' },
              action_id: 'set_preferences'
            },
            explore_library: {
              type: 'button',
              text: { type: 'plain_text', text: '📚 Explore Library' },
              action_id: 'explore_library'
            }
          };

          if (actionButtons[nextStep.action]) {
            blocks.push({
              type: 'actions',
              elements: [actionButtons[nextStep.action]]
            } as any);
          }
        }
      }
    } else {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🎉 *Onboarding Complete!*\nYou\'re all set up and ready to earn XP and compete in seasons!'
        }
      });
    }

    return blocks;
  }

  /**
   * Format notification preferences for Slack display
   */
  static formatPreferencesForSlack(preferences: NotificationPreferences): any[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '⚙️ *Your Notification Preferences*'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Streak Reminders:* ${preferences.streak_dms ? '✅ Enabled' : '❌ Disabled'}`
          },
          {
            type: 'mrkdwn',
            text: `*Weekly Digest:* ${preferences.weekly_digest ? '✅ Enabled' : '❌ Disabled'}`
          }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '⚙️ Update Preferences'
            },
            action_id: 'update_preferences',
            style: 'primary'
          }
        ]
      }
    ];
  }
}