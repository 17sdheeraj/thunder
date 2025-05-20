export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/slack/events' && request.method === 'POST') {
      return handleSlackEvent(request, env, ctx);
    }

    if (url.pathname === '/test') {
      return new Response(JSON.stringify({
        status: 'OK',
        message: 'Slack bot is running',
        timestamp: new Date().toISOString()
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    // Add ur scheduled tasks here
  },
};

async function handleSlackEvent(request, env, ctx) {
  let body;
  
  const contentType = request.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    body = await request.json();
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const payload = params.get('payload');
    if (payload) {
      try {
        body = JSON.parse(payload);
      } catch (e) {
        console.error('Failed to parse payload:', e);
        return new Response('Invalid payload format', { status: 400 });
      }
    } else {
      const command = params.get('command');
      const text = params.get('text') || '';
      const channel = params.get('channel_id');
      const user = params.get('user_id');
      const responseUrl = params.get('response_url');

      if (command) {
        const commandHandlers = {
          '/help': () => sendHelpMenu(env, channel, responseUrl),
          // Add ur command handlers here
        };

        const handler = commandHandlers[command];
        if (handler) {
          await handler();
          return new Response('', { status: 200 });
        }
      }

      body = {
        type: 'message',
        event: {
          type: 'message',
          text: text,
          channel: channel,
          user: user
        }
      };
    }
  }

  if (!body) {
    return new Response('Invalid request format', { status: 400 });
  }

  if (body.type === 'url_verification') {
    return new Response(body.challenge);
  }

  if (body.event?.type === 'message' && !body.event.bot_id) {
    const { text, channel, user } = body.event;
    if (!text) return new Response('OK', { status: 200 });
    
    const command = text.trim().split(' ')[0];
    const args = text.trim().split(' ').slice(1).join(' ');

    const commandHandlers = {
      '/help': () => sendHelpMenu(env, channel),
      // Add ur command handlers here
      'default': () => handleUrlPreviews(text, env, channel)
    };

    const handler = commandHandlers[command] || commandHandlers['default'];
    ctx.waitUntil(handler());
  }

  return new Response('OK', { status: 200 });
}

async function sendHelpMenu(env, channel, responseUrl = null) {
  const helpText = `🤖 *Slack Bot Help*\n` +
    `*Available Commands:*\n` +
    `/help - Show this menu\n` +
    // Add ur command descriptions here
    `\n*Automatic Features:*\n` +
    `URLs in messages will generate previews with screenshots`;
  
  await sendSlackMessage(env, channel, helpText, responseUrl);
}

async function handleUrlPreviews(text, env, channel, responseUrl = null) {
  const urls = extractUrls(text);
  if (urls.length === 0) return;

  try {
    const previews = await Promise.all(urls.map(async url => {
      try {
        const preview = await fetchUrlPreview(url);
        const screenshot = `https://image.thum.io/get/width/800/crop/768/noanimate/${encodeURIComponent(url)}`;
        return `${preview}\n🖼️ *Screenshot Preview:*\n${screenshot}`;
      } catch (error) {
        return `Failed to generate preview for ${url}`;
      }
    }));

    const previewText = previews.filter(Boolean).join('\n\n');
    if (previewText) {
      await sendSlackMessage(env, channel, previewText, responseUrl);
    }
  } catch (error) {
    console.error('URL preview error:', error);
  }
}

function extractUrls(text) {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s<>\]]+/g;
  return text.match(urlRegex) || [];
}

async function fetchUrlPreview(url) {
  try {
    const res = await fetch(url, { 
      method: 'GET',
      headers: { 'User-Agent': 'SlackBot/1.0 (+https://api.slack.com/robots)' }
    });
    const html = await res.text();

    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i);
    const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i);
    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']*)["']/i);

    const title = ogTitleMatch?.[1] || titleMatch?.[1] || 'No title found';
    const description = ogDescMatch?.[1] || descMatch?.[1] || 'No description found';
    const image = ogImageMatch?.[1] ? `\n🌅 *Preview Image:*\n${ogImageMatch[1]}` : '';

    return `🔗 *${title.trim()}*\n${description.trim()}\n${url}${image}`;
  } catch (error) {
    return `🔗 *URL Preview:*\n${url}\n(Could not fetch additional details)`;
  }
}

async function sendSlackMessage(env, channel, text, responseUrl = null) {
  const slackToken = env.SLACK_BOT_TOKEN;
  if (!slackToken) {
    console.error('Missing slack bot token bruh');
    return;
  }

  try {
    if (responseUrl) {
      await fetch(responseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
        },
        body: JSON.stringify({
          text,
          mrkdwn: true,
          response_type: 'in_channel'
        }),
      });
    } else {
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${slackToken}`,
          'Content-Type': 'application/json;charset=utf-8',
        },
        body: JSON.stringify({
          channel,
          text,
          mrkdwn: true,
          unfurl_links: false,
          unfurl_media: false
        }),
      });
    }
  } catch (error) {
    console.error('Failed to send slack message:', error);
  }
}

function decodeHtmlEntities(text) {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
} 