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
    // Get submissions for remix dropdown (exclude user's own submissions)
    const { SubmissionService } = await import('./services/submissionService');
    const { UserService } = await import('./services/userService');
    
    const user = await UserService.getUserBySlackId(body.user_id);
    const remixOptions = await SubmissionService.getSubmissionsForRemix(user?.user_id);
    
    const remixSelectOptions = remixOptions.map(sub => ({
      text: { type: 'plain_text' as const, text: sub.title },
      value: sub.id.toString()
    }));

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
            block_id: 'title_input',
            element: {
              type: 'plain_text_input',
              action_id: 'title_text',
              placeholder: {
                type: 'plain_text',
                text: 'Give your prompt a catchy title...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Title'
            },
            optional: true
          },
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
              text: 'Prompt/Workflow *'
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
                text: 'Describe what this prompt does, how to use it, or what makes it special...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Description'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'output_input',
            element: {
              type: 'plain_text_input',
              action_id: 'output_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Share an example output or result from using this prompt...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Example Output'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'tags_input',
            element: {
              type: 'plain_text_input',
              action_id: 'tags_text',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., writing, coding, analysis, creative'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Tags (comma-separated)'
            },
            optional: true
          },
          ...(remixSelectOptions.length > 0 ? [{
            type: 'input' as const,
            block_id: 'remix_input',
            element: {
              type: 'static_select' as const,
              action_id: 'remix_selection',
              placeholder: {
                type: 'plain_text' as const,
                text: 'Choose a prompt to remix...'
              },
              options: remixSelectOptions.slice(0, 100) // Slack has a 100 option limit
            },
            label: {
              type: 'plain_text' as const,
              text: 'Remix of (Optional)'
            },
            optional: true
          }] : [])
        ],
        submit: {
          type: 'plain_text',
          text: 'Submit'
        }
      }
    });
  } catch (error) {
    console.error('Error opening modal:', error);
    
    // Fallback modal without remix options
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
          }
        ],
        submit: {
          type: 'plain_text',
          text: 'Submit'
        }
      }
    });
  }
});

// Handle modal submission
app.view('submit_prompt_modal', async ({ ack, body, view, client }) => {
  await ack();
  
  try {
    const { SubmissionService } = await import('./services/submissionService');
    const { UserService } = await import('./services/userService');
    const { supabaseAdmin } = await import('./database/supabase');
    
    // Extract form values
    const title = view.state.values.title_input?.title_text?.value?.trim();
    const promptText = view.state.values.prompt_input.prompt_text.value?.trim() || '';
    const description = view.state.values.description_input?.description_text?.value?.trim();
    const outputSample = view.state.values.output_input?.output_text?.value?.trim();
    const tagsInput = view.state.values.tags_input?.tags_text?.value?.trim();
    const remixSelection = view.state.values.remix_input?.remix_selection?.selected_option?.value;
    
    // Validate required fields
    if (!promptText) {
      console.error('Prompt text is required');
      return;
    }
    
    // Parse tags
    const tags = tagsInput 
      ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
      : [];
    
    // Get or create user
    const user = await UserService.getOrCreateUser(body.user.id, body.user.name);
    
    // Determine submission type
    let submissionType: 'workflow' | 'challenge_response' | 'remix' = 'workflow';
    if (remixSelection) {
      submissionType = 'remix';
    }
    
    // Create submission
    const submission = await SubmissionService.createSubmission({
      authorId: user.user_id,
      title: title || undefined,
      promptText,
      description: description || undefined,
      outputSample: outputSample || undefined,
      tags,
      submissionType,
      parentSubmissionId: remixSelection ? parseInt(remixSelection) : undefined
    });
    
    // Record streak activity
    await SubmissionService.recordStreakActivity(user.user_id, 'submission');
    
    console.log('Submission created:', {
      submissionId: submission.submission_id,
      userId: user.user_id,
      type: submissionType
    });
    
    // Calculate XP earned (check submission count after creation)
    const submissionCount = await supabaseAdmin
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', user.user_id);
    
    const isFirst = (submissionCount.count || 0) === 1; // This was their first submission
    let xpEarned = 10; // Base submission XP
    if (isFirst) {
      xpEarned += 5; // First submission bonus
    }
    
    // Send confirmation DM with XP info
    const confirmationText = [
      `🎉 *Awesome submission!* Your prompt has been added to the AI Games library.`,
      ``,
      `💰 *XP Earned:* +${xpEarned} XP`,
      isFirst ? `🌟 *First submission bonus!* Welcome to AI Games!` : '',
      ``,
      `Check out your progress in the Home tab or use \`/status\` to see your stats.`
    ].filter(Boolean).join('\n');
    
    await client.chat.postMessage({
      channel: body.user.id,
      text: confirmationText,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: confirmationText
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📊 View Home Tab'
              },
              action_id: 'view_home_tab',
              url: `slack://app?team=${body.team?.id}&id=${process.env.SLACK_APP_ID}&tab=home`
            }
          ]
        }
      ]
    });
    
  } catch (error) {
    console.error('Error handling submission:', error);
    
    // Send error message to user
    await client.chat.postMessage({
      channel: body.user.id,
      text: `❌ Sorry, there was an error processing your submission. Please try again or contact support.`
    });
  }
});

// Handle 'Remix this' message shortcut
app.shortcut('remix_this_prompt', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const { SubmissionService } = await import('./services/submissionService');
    const { UserService } = await import('./services/userService');
    
    // Check if this is a message shortcut
    if (body.type !== 'message_action') {
      throw new Error('This shortcut only works on messages');
    }
    
    // Extract message details - now TypeScript knows this is a MessageShortcut
    const message = body.message;
    const messageText = message.text || '';
    const messageUser = message.user;
    const messageTs = message.ts;
    
    console.log('Remix shortcut triggered:', {
      messageText: messageText.substring(0, 100),
      messageUser,
      triggeredBy: body.user.id
    });
    
    // Try to find if this message corresponds to a submission
    // For now, we'll use the message text as the prompt to remix
    let originalSubmissionId: number | undefined;
    let originalPrompt = messageText;
    let originalTitle: string | undefined;
    
    // TODO: In a real implementation, you might store message_ts in submissions
    // or use message permalinks to track which messages are submissions
    
    // Get submissions for remix dropdown (for fallback)
    const user = await UserService.getUserBySlackId(body.user.id);
    const remixOptions = await SubmissionService.getSubmissionsForRemix(user?.user_id);
    
    const remixSelectOptions = remixOptions.map(sub => ({
      text: { type: 'plain_text' as const, text: sub.title },
      value: sub.id.toString()
    }));

    // Open the submit modal with pre-filled data
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'submit_prompt_modal',
        title: {
          type: 'plain_text',
          text: 'Remix This Prompt'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🎵 *Remixing a prompt!*\n\nYou're creating a remix based on ${messageUser ? `<@${messageUser}>'s` : 'this'} message. Add your own spin to make it even better!`
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'input',
            block_id: 'title_input',
            element: {
              type: 'plain_text_input',
              action_id: 'title_text',
              placeholder: {
                type: 'plain_text',
                text: 'Give your remix a catchy title...'
              },
              initial_value: originalTitle ? `${originalTitle} (Remix)` : ''
            },
            label: {
              type: 'plain_text',
              text: 'Title'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'prompt_input',
            element: {
              type: 'plain_text_input',
              action_id: 'prompt_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Modify and improve the original prompt...'
              },
              initial_value: originalPrompt
            },
            label: {
              type: 'plain_text',
              text: 'Prompt/Workflow *'
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
                text: 'Describe what you changed or improved in your remix...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'What did you improve?'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'output_input',
            element: {
              type: 'plain_text_input',
              action_id: 'output_text',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Share an example output from your improved prompt...'
              }
            },
            label: {
              type: 'plain_text',
              text: 'Example Output'
            },
            optional: true
          },
          {
            type: 'input',
            block_id: 'tags_input',
            element: {
              type: 'plain_text_input',
              action_id: 'tags_text',
              placeholder: {
                type: 'plain_text',
                text: 'e.g., remix, improved, creative'
              },
              initial_value: 'remix'
            },
            label: {
              type: 'plain_text',
              text: 'Tags (comma-separated)'
            },
            optional: true
          },
          ...(remixSelectOptions.length > 0 ? [{
            type: 'input' as const,
            block_id: 'remix_input',
            element: {
              type: 'static_select' as const,
              action_id: 'remix_selection',
              placeholder: {
                type: 'plain_text' as const,
                text: 'Link to original submission (optional)...'
              },
              options: remixSelectOptions.slice(0, 100),
              ...(originalSubmissionId ? { initial_option: {
                text: { type: 'plain_text' as const, text: originalTitle || 'Original Submission' },
                value: originalSubmissionId.toString()
              }} : {})
            },
            label: {
              type: 'plain_text' as const,
              text: 'Original Submission (Optional)'
            },
            optional: true
          }] : []),
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `💡 *Remix Tip:* Great remixes build on the original by adding clarity, specificity, or creative improvements. Share what makes your version special!`
              }
            ]
          }
        ],
        submit: {
          type: 'plain_text',
          text: 'Submit Remix'
        }
      }
    });
    
  } catch (error) {
    console.error('Error handling remix shortcut:', error);
    
    // Send error message to user
    const channelId = body.type === 'message_action' ? body.channel.id : body.user.id;
    await client.chat.postEphemeral({
      channel: channelId,
      user: body.user.id,
      text: `❌ Sorry, there was an error setting up the remix. Please try using \`/submit\` directly.`
    });
  }
});

// Start the app
(async () => {
  await app.start();
  console.log('⚡️ AI Games Slack app is running!');
})();