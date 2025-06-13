import { App } from '@slack/bolt';
import dotenv from 'dotenv';

dotenv.config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  port: parseInt(process.env.PORT || '3000')
});

// Handle app_home_opened event
app.event('app_home_opened', async ({ event, client }) => {
  try {
    console.log('Home tab opened by user:', event.user);
    
    // Basic home tab view
    await client.views.publish({
      user_id: event.user,
      view: {
        type: 'home',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🎮 *Welcome to AI Games!*\n\nThis is your personal dashboard where you can track your XP, streaks, and compete with your team!'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '📊 *Your Stats*\n• XP: 0\n• Current Streak: 0 days\n• Season Progress: Just getting started!'
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error publishing home tab:', error);
  }
});

// Handle /submit slash command
app.command('/submit', async ({ ack, body, client }) => {
  await ack();
  
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'submit_prompt_modal',
        title: {
          type: 'plain_text',
          text: 'Submit Your Prompt'
        },
        blocks: [
          {
            type: 'input',
            block_id: 'prompt_input',
            element: {
              type: 'plain_text_input',
              action_id: 'prompt_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Enter your AI prompt or workflow here...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Prompt/Workflow'
            }
          },
          {
            type: 'input',
            block_id: 'description_input',
            element: {
              type: 'plain_text_input',
              action_id: 'description_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Optional: Describe what this prompt does or how to use it...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Description (Optional)'
            },
            optional: true
          }
        ],
        submit: {
          type: 'plain_text',
          text: 'Submit'
        }
      }
    });
  } catch (error) {
    console.error('Error opening modal:', error);
  }
});

// Handle modal submission
app.view('submit_prompt_modal', async ({ ack, body, view, client }) => {
  await ack();
  
  try {
    const promptText = view.state.values.prompt_input.prompt_text.value;
    const description = view.state.values.description_input?.description_text?.value || '';
    
    console.log('Prompt submitted:', { promptText, description, user: body.user.id });
    
    // TODO: Save to database and award XP
    
    // Send confirmation DM
    await client.chat.postMessage({
      channel: body.user.id,
      text: `🎉 Great submission! You've earned XP for sharing your prompt. Keep it up!`
    });
    
  } catch (error) {
    console.error('Error handling submission:', error);
  }
});

// Start the app
(async () => {
  await app.start();
  console.log('⚡️ AI Games Slack app is running!');
})();