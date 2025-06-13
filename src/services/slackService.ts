import { App } from '@slack/bolt';
import { ChallengeService, WeeklyChallenge } from './challengeService';

export class SlackService {
  private app: App;
  private challengeChannelId: string;

  constructor(app: App, challengeChannelId: string = process.env.CHALLENGE_CHANNEL_ID || 'general') {
    this.app = app;
    this.challengeChannelId = challengeChannelId;
  }

  /**
   * Post the weekly challenge to the designated Slack channel
   */
  async postWeeklyChallenge(challenge: WeeklyChallenge): Promise<string> {
    try {
      const messageContent = ChallengeService.formatChallengeForSlack(challenge);
      
      const result = await this.app.client.chat.postMessage({
        channel: this.challengeChannelId,
        text: messageContent.text,
        blocks: messageContent.blocks,
        unfurl_links: false,
        unfurl_media: false
      });

      if (!result.ok || !result.ts) {
        throw new Error(`Failed to post challenge: ${result.error}`);
      }

      console.log('Weekly challenge posted successfully:', {
        channel: this.challengeChannelId,
        timestamp: result.ts,
        week: challenge.week_number
      });

      // Mark challenge as active after successful posting
      await ChallengeService.markChallengeAsActive(challenge.seed_prompt_id);

      return result.ts;
    } catch (error) {
      console.error('Error posting weekly challenge:', error);
      throw error;
    }
  }

  /**
   * Post a challenge reminder (mid-week)
   */
  async postChallengeReminder(): Promise<string> {
    try {
      const currentChallenge = await ChallengeService.getCurrentWeekChallenge();
      
      if (!currentChallenge) {
        throw new Error('No active challenge found');
      }

      const stats = await ChallengeService.getChallengeStats(currentChallenge.seed_prompt_id);
      
      const reminderContent = {
        text: `🔔 Mid-week reminder: Week ${currentChallenge.week_number} Challenge!`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🔔 *Mid-week reminder!*\n\nDon't forget about this week's AI prompt challenge. We've had ${stats.total_submissions} submissions from ${stats.unique_participants} participants so far!`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*This week's prompt:*\n${currentChallenge.prompt_text}`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '🚀 Submit Now'
                },
                action_id: 'submit_challenge_response',
                style: 'primary'
              }
            ]
          }
        ]
      };

      const result = await this.app.client.chat.postMessage({
        channel: this.challengeChannelId,
        text: reminderContent.text,
        blocks: reminderContent.blocks
      });

      if (!result.ok || !result.ts) {
        throw new Error(`Failed to post reminder: ${result.error}`);
      }

      return result.ts;
    } catch (error) {
      console.error('Error posting challenge reminder:', error);
      throw error;
    }
  }

  /**
   * Post weekly challenge results/digest
   */
  async postChallengeResults(challenge: WeeklyChallenge): Promise<string> {
    try {
      const stats = await ChallengeService.getChallengeStats(challenge.seed_prompt_id);
      
      const resultsContent = {
        text: `📊 Week ${challenge.week_number} Challenge Results`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `📊 Week ${challenge.week_number} Challenge Results`
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Total Submissions:*\n${stats.total_submissions}`
              },
              {
                type: 'mrkdwn',
                text: `*Participants:*\n${stats.unique_participants}`
              },
              {
                type: 'mrkdwn',
                text: `*Average Quality Score:*\n${stats.avg_xp_score.toFixed(1)}/10`
              },
              {
                type: 'mrkdwn',
                text: `*Top Submission:*\n${stats.top_submission?.title || 'N/A'}`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🎉 Thanks to everyone who participated in this week's challenge! The creativity and quality of submissions was amazing.\n\n🚀 *Get ready for next week's challenge on Monday!*`
            }
          }
        ]
      };

      const result = await this.app.client.chat.postMessage({
        channel: this.challengeChannelId,
        text: resultsContent.text,
        blocks: resultsContent.blocks
      });

      if (!result.ok || !result.ts) {
        throw new Error(`Failed to post results: ${result.error}`);
      }

      return result.ts;
    } catch (error) {
      console.error('Error posting challenge results:', error);
      throw error;
    }
  }

  /**
   * Send a DM notification about new challenges
   */
  async notifyUserOfNewChallenge(userId: string, challenge: WeeklyChallenge): Promise<void> {
    try {
      await this.app.client.chat.postMessage({
        channel: userId,
        text: `🎯 New AI Prompt Challenge is live!`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🎯 *Week ${challenge.week_number} AI Prompt Challenge is now live!*\n\n${challenge.prompt_text}\n\nHead over to the challenge channel to participate and earn bonus XP!`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '🚀 View Challenge'
                },
                action_id: 'view_challenge',
                url: `slack://channel?team=${process.env.SLACK_TEAM_ID}&id=${this.challengeChannelId}`
              }
            ]
          }
        ]
      });
    } catch (error) {
      console.error('Error sending challenge notification:', error);
      // Don't throw here since this is just a notification
    }
  }
}