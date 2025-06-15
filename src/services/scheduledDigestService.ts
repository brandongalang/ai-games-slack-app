import { supabaseAdmin } from '../database/supabase';
import { User } from '../database/types';
import { DigestWriterService } from './digestWriterService';
import { SecurityService } from './securityService';

export interface DigestSchedule {
  id: string;
  type: 'community' | 'personal';
  frequency: 'weekly' | 'monthly';
  dayOfWeek?: number; // 0 = Sunday, 1 = Monday, etc.
  timeOfDay: string; // HH:MM format
  timezone: string;
  enabled: boolean;
  channelId?: string; // For community digests
  lastRun?: string;
  nextRun: string;
  metadata?: Record<string, any>;
}

export interface DigestDelivery {
  delivery_id: number;
  schedule_id: string;
  digest_type: 'community' | 'personal';
  recipient_type: 'channel' | 'user';
  recipient_id: string;
  user_id?: number;
  digest_content: string;
  delivery_status: 'pending' | 'sent' | 'failed';
  scheduled_for: string;
  delivered_at?: string;
  error_message?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface DigestAnalytics {
  period: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  communityDigests: number;
  personalDigests: number;
  avgGenerationTime: number;
  topFailureReasons: Array<{ reason: string; count: number }>;
}

export class ScheduledDigestService {
  private static readonly DEFAULT_SCHEDULES: Omit<DigestSchedule, 'id' | 'nextRun'>[] = [
    {
      type: 'community',
      frequency: 'weekly',
      dayOfWeek: 1, // Monday
      timeOfDay: '09:00',
      timezone: 'UTC',
      enabled: true,
      channelId: process.env.SLACK_DIGEST_CHANNEL || 'general',
      metadata: {
        includeSeasonProgress: true,
        highlightTopPerformers: true
      }
    }
  ];

  /**
   * Initialize digest scheduling system
   */
  static async initializeScheduling(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Initializing digest scheduling system...');

      // Create digest_schedules table if it doesn't exist
      await this.ensureScheduleTable();

      // Create digest_deliveries table if it doesn't exist
      await this.ensureDeliveryTable();

      // Set up default schedules if none exist
      const { data: existingSchedules } = await supabaseAdmin
        .from('digest_schedules')
        .select('*');

      if (!existingSchedules || existingSchedules.length === 0) {
        await this.createDefaultSchedules();
      }

      console.log('Digest scheduling system initialized successfully');
      return { success: true };

    } catch (error) {
      console.error('Error initializing digest scheduling:', error);
      return { success: false, error: 'Failed to initialize scheduling system' };
    }
  }

  /**
   * Process scheduled digests (called by cron job)
   */
  static async processScheduledDigests(): Promise<{
    success: boolean;
    processed: number;
    delivered: number;
    failed: number;
    errors?: string[];
  }> {
    try {
      console.log('Processing scheduled digests...');

      const now = new Date().toISOString();
      const errors: string[] = [];
      let processed = 0;
      let delivered = 0;
      let failed = 0;

      // Get due schedules
      const { data: dueSchedules } = await supabaseAdmin
        .from('digest_schedules')
        .select('*')
        .eq('enabled', true)
        .lte('next_run', now);

      if (!dueSchedules || dueSchedules.length === 0) {
        console.log('No scheduled digests due for processing');
        return { success: true, processed: 0, delivered: 0, failed: 0 };
      }

      console.log(`Found ${dueSchedules.length} scheduled digests to process`);

      // Process each schedule
      for (const schedule of dueSchedules) {
        processed++;

        try {
          if (schedule.type === 'community') {
            const result = await this.processCommunityDigest(schedule);
            if (result.success) {
              delivered++;
            } else {
              failed++;
              errors.push(`Community digest failed: ${result.error}`);
            }
          } else if (schedule.type === 'personal') {
            const result = await this.processPersonalDigests(schedule);
            delivered += result.delivered;
            failed += result.failed;
            errors.push(...result.errors);
          }

          // Update next run time
          await this.updateNextRunTime(schedule);

        } catch (error) {
          failed++;
          const errorMsg = `Error processing schedule ${schedule.id}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(`Digest processing complete: ${processed} processed, ${delivered} delivered, ${failed} failed`);

      return {
        success: true,
        processed,
        delivered,
        failed,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('Error processing scheduled digests:', error);
      return {
        success: false,
        processed: 0,
        delivered: 0,
        failed: 0,
        errors: ['Failed to process scheduled digests']
      };
    }
  }

  /**
   * Process community digest delivery
   */
  private static async processCommunityDigest(schedule: DigestSchedule): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log(`Processing community digest for schedule ${schedule.id}`);

      // Generate community digest
      const digestResult = await DigestWriterService.generateCommunityDigest({
        highlightSeasonProgress: schedule.metadata?.includeSeasonProgress || true,
        focusOnCommunityGrowth: true,
        includeMotivationalQuotes: true
      });

      if (!digestResult.success || !digestResult.digest) {
        throw new Error(digestResult.error || 'Failed to generate digest');
      }

      // Create delivery record
      const delivery = await this.createDeliveryRecord({
        schedule_id: schedule.id,
        digest_type: 'community',
        recipient_type: 'channel',
        recipient_id: schedule.channelId!,
        digest_content: digestResult.digest,
        delivery_status: 'pending',
        scheduled_for: new Date().toISOString(),
        metadata: {
          generationTime: Date.now(),
          scheduleType: schedule.frequency
        }
      });

      // Send to Slack channel
      const slackApp = await this.getSlackApp();
      if (!slackApp) {
        throw new Error('Slack app not available');
      }

      await slackApp.client.chat.postMessage({
        channel: schedule.channelId!,
        text: digestResult.digest,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: digestResult.digest
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '📅 *Automatically generated weekly digest* • Use `/preferences update` to manage your notification settings'
              }
            ]
          }
        ]
      });

      // Update delivery status
      await this.updateDeliveryStatus(delivery.delivery_id, 'sent');

      // Log security event
      await SecurityService.logSecurityEvent({
        eventType: 'admin_action',
        description: `Automated community digest delivered to ${schedule.channelId}`,
        riskLevel: 'low',
        metadata: { 
          scheduleId: schedule.id,
          channelId: schedule.channelId,
          automated: true
        }
      });

      console.log(`Community digest delivered successfully to ${schedule.channelId}`);
      return { success: true };

    } catch (error) {
      console.error('Error processing community digest:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Process personal digest deliveries
   */
  private static async processPersonalDigests(schedule: DigestSchedule): Promise<{
    delivered: number;
    failed: number;
    errors: string[];
  }> {
    try {
      console.log(`Processing personal digests for schedule ${schedule.id}`);

      let delivered = 0;
      let failed = 0;
      const errors: string[] = [];

      // Get users who have personal digest notifications enabled
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('notification_preferences->>weekly_digest', true);

      if (!users || users.length === 0) {
        console.log('No users have personal digest notifications enabled');
        return { delivered: 0, failed: 0, errors: [] };
      }

      console.log(`Generating personal digests for ${users.length} users`);

      const slackApp = await this.getSlackApp();
      if (!slackApp) {
        throw new Error('Slack app not available');
      }

      // Process users in batches to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (user) => {
          try {
            // Generate personal digest
            const digestResult = await DigestWriterService.generatePersonalDigest(user.user_id, {
              includePersonalizedIntro: true,
              includeMotivationalQuotes: true
            });

            if (!digestResult.success || !digestResult.digest) {
              throw new Error(digestResult.error || 'Failed to generate personal digest');
            }

            // Create delivery record
            const delivery = await this.createDeliveryRecord({
              schedule_id: schedule.id,
              digest_type: 'personal',
              recipient_type: 'user',
              recipient_id: user.slack_id,
              user_id: user.user_id,
              digest_content: digestResult.digest,
              delivery_status: 'pending',
              scheduled_for: new Date().toISOString(),
              metadata: {
                userId: user.user_id,
                generationTime: Date.now()
              }
            });

            // Send DM to user
            await slackApp.client.chat.postMessage({
              channel: user.slack_id,
              text: digestResult.digest,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: digestResult.digest
                  }
                },
                {
                  type: 'context',
                  elements: [
                    {
                      type: 'mrkdwn',
                      text: '📊 *Your weekly personal digest* • Use `/preferences update` to manage these notifications'
                    }
                  ]
                }
              ]
            });

            // Update delivery status
            await this.updateDeliveryStatus(delivery.delivery_id, 'sent');
            delivered++;

          } catch (error) {
            failed++;
            const errorMsg = `Failed to send personal digest to user ${user.user_id}: ${error}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }
        }));

        // Add delay between batches to respect rate limits
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Personal digest processing complete: ${delivered} delivered, ${failed} failed`);
      return { delivered, failed, errors };

    } catch (error) {
      console.error('Error processing personal digests:', error);
      return { delivered: 0, failed: 1, errors: [String(error)] };
    }
  }

  /**
   * Create a new digest schedule
   */
  static async createDigestSchedule(schedule: Omit<DigestSchedule, 'id' | 'nextRun'>): Promise<{
    success: boolean;
    scheduleId?: string;
    error?: string;
  }> {
    try {
      const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const nextRun = this.calculateNextRun(schedule);

      const { error } = await supabaseAdmin
        .from('digest_schedules')
        .insert({
          id: scheduleId,
          ...schedule,
          next_run: nextRun,
          created_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      console.log(`Created digest schedule: ${scheduleId}`);
      return { success: true, scheduleId };

    } catch (error) {
      console.error('Error creating digest schedule:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Update digest schedule
   */
  static async updateDigestSchedule(
    scheduleId: string,
    updates: Partial<DigestSchedule>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = { ...updates };
      
      // Recalculate next run if timing changed
      if (updates.dayOfWeek !== undefined || updates.timeOfDay !== undefined || updates.frequency !== undefined) {
        const { data: currentSchedule } = await supabaseAdmin
          .from('digest_schedules')
          .select('*')
          .eq('id', scheduleId)
          .single();

        if (currentSchedule) {
          const mergedSchedule = { ...currentSchedule, ...updates };
          updateData.next_run = this.calculateNextRun(mergedSchedule);
        }
      }

      updateData.updated_at = new Date().toISOString();

      const { error } = await supabaseAdmin
        .from('digest_schedules')
        .update(updateData)
        .eq('id', scheduleId);

      if (error) {
        throw error;
      }

      console.log(`Updated digest schedule: ${scheduleId}`);
      return { success: true };

    } catch (error) {
      console.error('Error updating digest schedule:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get digest analytics
   */
  static async getDigestAnalytics(days: number = 30): Promise<DigestAnalytics | null> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: deliveries } = await supabaseAdmin
        .from('digest_deliveries')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (!deliveries) {
        return null;
      }

      const totalDeliveries = deliveries.length;
      const successfulDeliveries = deliveries.filter(d => d.delivery_status === 'sent').length;
      const failedDeliveries = deliveries.filter(d => d.delivery_status === 'failed').length;
      const communityDigests = deliveries.filter(d => d.digest_type === 'community').length;
      const personalDigests = deliveries.filter(d => d.digest_type === 'personal').length;

      // Calculate average generation time
      const generationTimes = deliveries
        .map(d => d.metadata?.generationTime)
        .filter(time => typeof time === 'number');
      
      const avgGenerationTime = generationTimes.length > 0
        ? generationTimes.reduce((sum, time) => sum + time, 0) / generationTimes.length
        : 0;

      // Analyze failure reasons
      const failureReasons = new Map<string, number>();
      deliveries
        .filter(d => d.delivery_status === 'failed' && d.error_message)
        .forEach(d => {
          const reason = d.error_message!.split(':')[0]; // Extract first part of error
          failureReasons.set(reason, (failureReasons.get(reason) || 0) + 1);
        });

      const topFailureReasons = Array.from(failureReasons.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        period: `Last ${days} days`,
        totalDeliveries,
        successfulDeliveries,
        failedDeliveries,
        communityDigests,
        personalDigests,
        avgGenerationTime,
        topFailureReasons
      };

    } catch (error) {
      console.error('Error getting digest analytics:', error);
      return null;
    }
  }

  /**
   * Helper methods
   */
  private static async ensureScheduleTable(): Promise<void> {
    // This would create the table if it doesn't exist
    // For now, assume it exists in the database schema
  }

  private static async ensureDeliveryTable(): Promise<void> {
    // This would create the table if it doesn't exist
    // For now, assume it exists in the database schema
  }

  private static async createDefaultSchedules(): Promise<void> {
    console.log('Creating default digest schedules...');

    for (const schedule of this.DEFAULT_SCHEDULES) {
      await this.createDigestSchedule(schedule);
    }
  }

  private static calculateNextRun(schedule: DigestSchedule | any): string {
    const now = new Date();
    const nextRun = new Date();

    if (schedule.frequency === 'weekly') {
      // Calculate next occurrence of the specified day of week
      const currentDay = now.getUTCDay();
      const targetDay = schedule.dayOfWeek || 1; // Default to Monday
      
      let daysUntilTarget = targetDay - currentDay;
      if (daysUntilTarget <= 0) {
        daysUntilTarget += 7; // Next week
      }

      nextRun.setUTCDate(now.getUTCDate() + daysUntilTarget);
    } else if (schedule.frequency === 'monthly') {
      // Next month, same day
      nextRun.setUTCMonth(now.getUTCMonth() + 1);
    }

    // Set time
    const [hours, minutes] = (schedule.timeOfDay || '09:00').split(':');
    nextRun.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

    return nextRun.toISOString();
  }

  private static async updateNextRunTime(schedule: DigestSchedule): Promise<void> {
    const nextRun = this.calculateNextRun(schedule);
    
    await supabaseAdmin
      .from('digest_schedules')
      .update({
        last_run: new Date().toISOString(),
        next_run: nextRun
      })
      .eq('id', schedule.id);
  }

  private static async createDeliveryRecord(delivery: Omit<DigestDelivery, 'delivery_id' | 'created_at'>): Promise<DigestDelivery> {
    const { data, error } = await supabaseAdmin
      .from('digest_deliveries')
      .insert({
        ...delivery,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  private static async updateDeliveryStatus(
    deliveryId: number, 
    status: 'sent' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      delivery_status: status,
      delivered_at: new Date().toISOString()
    };

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    await supabaseAdmin
      .from('digest_deliveries')
      .update(updateData)
      .eq('delivery_id', deliveryId);
  }

  private static async getSlackApp(): Promise<any> {
    // In a real implementation, this would use dependency injection
    // For now, we'll expect the app to be passed through or use a global reference
    try {
      // Try to get from global context or environment
      const globalApp = (global as any).slackApp;
      if (globalApp) {
        return globalApp;
      }
      
      // Fallback: return null and let the caller handle the error
      console.warn('Slack app not available in ScheduledDigestService');
      return null;
    } catch (error) {
      console.error('Error getting Slack app:', error);
      return null;
    }
  }
}