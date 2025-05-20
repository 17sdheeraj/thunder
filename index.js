function getTimezoneOffsetMinutes(ianaTimeZone) {
  const date = new Date();

  const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimeZone,
      timeZoneName: 'shortOffset',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const offsetPart = parts.find(p => p.type === 'timeZoneName');

  if (!offsetPart || typeof offsetPart.value !== 'string') return null;

  const match = offsetPart.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);

  if (!match || !match[1] || !match[2]) {
      return null;
  }

  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3] ?? '0', 10);

  if (isNaN(hours) || isNaN(minutes)) return null;

  return sign * (hours * 60 + minutes);
}

function getBMTBeatTime(date) {
  const bmt = new Date(date.getTime() + 3600000);
  
  const seconds = bmt.getUTCHours() * 3600 + bmt.getUTCMinutes() * 60 + bmt.getUTCSeconds();

  const beat = Math.round(seconds / 86.4).toString().padStart(3, '0');

  return `@${beat}`;
}

export default {
async fetch(request, env, ctx) {
  const url = new URL(request.url);

  if (url.pathname === '/slack/events' && request.method === 'POST') {
    return handleSlackEvent(request, env, ctx);
  }

  if (url.pathname === '/qotd') {
    return sendQuoteOfTheDay(env, 'C087FKLR77B');
  }

  if (url.pathname === '/test') {
    return new Response(JSON.stringify({
      status: 'OK',
      message: 'Slack bot is running yayyayayyayayay',
      timestamp: new Date().toISOString()
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (url.pathname === '/') {
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Advanced Slack Bot</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
          }
          h1 {
            color: #4A154B;
            border-bottom: 2px solid #4A154B;
            padding-bottom: 10px;
          }
          .status {
            background: #f0f0f0;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .commands {
            background: #f8f8f8;
            padding: 20px;
            border-radius: 8px;
          }
          code {
            background: #eee;
            padding: 2px 5px;
            border-radius: 3px;
            font-family: monospace;
          }
          .emoji {
            font-size: 1.2em;
          }
        </style>
      </head>
      <body>
        <h1>🤖 Advanced Slack Bot</h1>
        
        <div class="status">
          <h2>✨ Status</h2>
          <p>The bot is up and running!</p>
          <p>Last checked: ${new Date().toLocaleString()}</p>
        </div>

        <div class="commands">
          <h2>🎮 Available Commands</h2>
          <ul>
            <li><code>/help</code> - Show help menu</li>
            <li><code>/qotd</code> - Get quote of the day</li>
            <li><code>/trivia</code> - Random trivia</li>
            <li><code>/dadjoke</code> - Get a dad joke</li>
            <li><code>/urban &lt;term&gt;</code> - Urban Dictionary lookup</li>
            <li><code>/beat [time/@XXX]</code> - Convert .beat time</li>
            <li><code>/dt-search &lt;query&gt;</code> - Web search</li>
            <li><code>/weather &lt;city&gt;</code> - Weather info</li>
            <li><code>/axolotl</code> - Random axolotl pics</li>
            <li><code>/catfact</code> - Random cat facts</li>
            <li><code>/dogfact</code> - Random dog facts</li>
            <li>and more! </li>
          </ul>
        </div>

        <p>Made with too much coffee ☕</p>
      </body>
      </html>
    `, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8'
      }
    });
  }

  return new Response('Not found', { status: 404 });
},

async scheduled(event, env, ctx) {
  ctx.waitUntil(sendQuoteOfTheDay(env, 'C087FKLR77B'));
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
        '/dt-search': () => handleSearch(text, env, channel, responseUrl),
        '/userinfo': () => handleUserInfo(`<@${user}>`, env, channel, responseUrl),
        '/dt-poll': () => handlePoll(text, env, channel, responseUrl),
        '/dt-remind': () => handleReminder(text, env, channel, responseUrl),
        '/qotd': () => sendQuoteOfTheDay(env, channel, responseUrl),
        '/trivia': () => sendTrivia(env, channel, responseUrl),
        '/dadjoke': () => sendDadJoke(env, channel, responseUrl),
        '/urban': () => sendUrbanDefinition(env, channel, text, responseUrl),
        '/disify': () => handleDisposableEmail(text, env, channel, responseUrl),
        '/dns': () => handleDnsLookup(text, env, channel, responseUrl),
        '/website': () => handleWebsiteInfo(text, env, channel, responseUrl),
        '/weather': () => handleWeather(text, env, channel, responseUrl),
        '/help': () => sendHelpMenu(env, channel, responseUrl),
        '/song': () => handleSongSearch(text, env, channel, responseUrl),
        '/ip': () => handleIpLookup(text, env, channel, responseUrl),
        '/axolotl': () => sendAxolotl(env, channel, responseUrl),
        '/catfact': () => sendCatFact(env, channel, responseUrl),
        '/dogfact': () => sendDogFact(env, channel, responseUrl),
        '/errorid': () => handleHttpCat(text, env, channel, responseUrl),
        '/beat': () => handleBeatCommand(text, env, channel, responseUrl)
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
    '/dt-search': () => handleSearch(args, env, channel),
    '/userinfo': () => handleUserInfo(text, env, channel),
    '/dt-poll': () => handlePoll(args, env, channel),
    '/dt-remind': () => handleReminder(args, env, channel),
    '/qotd': () => sendQuoteOfTheDay(env, channel),
    '/trivia': () => sendTrivia(env, channel),
    '/dadjoke': () => sendDadJoke(env, channel),
    '/urban': () => sendUrbanDefinition(env, channel, args),
    '/disify': () => handleDisposableEmail(args, env, channel),
    '/dns': () => handleDnsLookup(args, env, channel),
    '/website': () => handleWebsiteInfo(args, env, channel),
    '/weather': () => handleWeather(args, env, channel),
    '/help': () => sendHelpMenu(env, channel),
    '/song': () => handleSongSearch(args, env, channel),
    '/ip': () => handleIpLookup(args, env, channel),
    '/axolotl': () => sendAxolotl(env, channel),
    '/catfact': () => sendCatFact(env, channel),
    '/dogfact': () => sendDogFact(env, channel),
    '/errorid': () => handleHttpCat(args, env, channel),
    '/beat': () => handleBeatCommand(text, env, channel),
    'default': () => handleUrlPreviews(text, env, channel)
  };

  const handler = commandHandlers[command] || commandHandlers['default'];
  ctx.waitUntil(handler());
}

return new Response('OK', { status: 200 });
}

async function handleSearch(query, env, channel, responseUrl = null) {
if (!query) {
  return sendSlackMessage(env, channel, 'Please provide a search query. Usage: `/dt-search queryhere`', responseUrl);
}

try {
  const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
  const data = await res.json();
  
  let response = `🔍 *Search Results for "${query}":*\n`;
  
  if (data.AbstractText) {
    response += `${data.AbstractText}\n`;
  } else if (data.RelatedTopics?.length > 0) {
    response += data.RelatedTopics.slice(0, 3).map(topic => 
      topic.Text || topic.FirstURL?.replace('https://', '')
    ).filter(Boolean).join('\n') + '\n';
  }
  
  response += `More results: https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  await sendSlackMessage(env, channel, response, responseUrl);
} catch (error) {
  await sendSlackMessage(env, channel, `Failed to search :(  Try again later`, responseUrl);
}
}

async function handleUserInfo(text, env, channel, responseUrl = null) {
const userId = text.match(/<@(\w+)>/)?.[1];
if (!userId) {
  return sendSlackMessage(env, channel, 'Please mention a user. Usage: `/userinfo @username`', responseUrl);
}

try {
  const userInfo = await getUserInfo(env, userId);
  await sendSlackMessage(env, channel, userInfo, responseUrl);
} catch (error) {
  await sendSlackMessage(env, channel, 'Failed to fetch user info.', responseUrl);
}
}

async function handlePoll(question, env, channel, responseUrl = null) {
if (!question) {
  return sendSlackMessage(env, channel, 'Please provide a poll question. Usage: `/dt-poll questionhere`', responseUrl);
}

const pollMessage = `📊 *Poll:* ${question}\nReact with :thumbsup: or :thumbsdown:`;
await sendSlackMessage(env, channel, pollMessage, responseUrl);
}

async function handleReminder(task, env, channel, responseUrl = null) {
if (!task) {
  return sendSlackMessage(env, channel, 'Please provide a reminder. Usage: `/dt-remind Do something`', responseUrl);
}

const reminderText = `⏰ *Reminder set:* ${task}`;
await sendSlackMessage(env, channel, reminderText, responseUrl);
}

async function handleDisposableEmail(email, env, channel, responseUrl = null) {
if (!email) {
  return sendSlackMessage(env, channel, 'Please provide an email. Usage: `/disify email@example.com`', responseUrl);
}

try {
  const res = await fetch(`https://www.disify.com/api/email/${email}`);
  const json = await res.json();
  const message = `📧 *Disify Info:*\nEmail: ${email}\nDisposable: ${json.disposable ? 'Yes' : 'No'}\nDomain Exists: ${json.dns ? 'Yes' : 'No'}\nFormat Valid: ${json.format ? 'Yes' : 'No'}`;
  await sendSlackMessage(env, channel, message, responseUrl);
} catch (error) {
  await sendSlackMessage(env, channel, 'Failed to check email.', responseUrl);
}
}

async function handleDnsLookup(domain, env, channel, responseUrl = null) {
if (!domain) {
  return sendSlackMessage(env, channel, 'Please provide a domain. Usage: `/dns example.com`', responseUrl);
}

try {
  const ip = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=A`, {
    headers: { 'Accept': 'application/dns-json' }
  });
  const data = await ip.json();
  const answers = data.Answer?.map(a => `${a.name} (${a.type}) → ${a.data}`).join('\n') || 'No DNS records found.';
  await sendSlackMessage(env, channel, `🌐 DNS Lookup for *${domain}*:\n${answers}`, responseUrl);
} catch (error) {
  await sendSlackMessage(env, channel, 'DNS Lookup failed.', responseUrl);
}
}

async function handleWebsiteInfo(domain, env, channel, responseUrl = null) {
if (!domain) {
  return sendSlackMessage(env, channel, 'Please provide a domain. Usage: `/website example.com`', responseUrl);
}

try {
  const url = domain.startsWith('http') ? domain : `https://${domain}`;
  const res = await fetch(url, { 
    method: 'GET',
    headers: { 'User-Agent': 'SlackBot/1.0 (+https://api.slack.com/robots)' }
  });
  const html = await res.text();
  const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || 'No title';
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] || 'No description';
  
  const preview = `🌍 *Website Preview for:* ${domain}\nTitle: ${title}\nDescription: ${description}`;
  await sendSlackMessage(env, channel, preview, responseUrl);
} catch (error) {
  await sendSlackMessage(env, channel, 'Failed to fetch website info :(  Try again later', responseUrl);
}
}

async function handleWeather(location, env, channel, responseUrl = null) {
const city = location || 'Hyderabad';

try {
  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}`);
  const geoJson = await geoRes.json();
  
  if (!geoJson.results || geoJson.results.length === 0) {
    return sendSlackMessage(env, channel, 'Location not found, try searching up ohio', responseUrl);
  }
  
  const { latitude, longitude, name, country } = geoJson.results[0];
  
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,weathercode`
  );
  const weatherJson = await weatherRes.json();
  const current = weatherJson.current_weather;
  
  const weatherDescriptions = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Thunderstorm with heavy hail'
  };
  
  const weatherDesc = weatherDescriptions[current.weathercode] || 'Unknown weather';
  
  await sendSlackMessage(env, channel, 
    `🌦️ *Weather in ${name}, ${country}:*\n` +
    `Condition: ${weatherDesc}\n` +
    `Temperature: ${current.temperature}°C\n` +
    `Wind: ${current.windspeed} km/h\n` +
    `Time: ${new Date(current.time).toLocaleTimeString()}`, responseUrl
  );
} catch (error) {
  await sendSlackMessage(env, channel, 'Failed to fetch weather data.', responseUrl);
}
}

async function sendHelpMenu(env, channel, responseUrl = null) {
const helpText = `🤖 *Advanced Slack Bot Help*\n` +
  `*General Commands:*\n` +
  `/help - Show this menu\n` +
  `/qotd - Get the quote of the day\n` +
  `/trivia - Get a random trivia question\n` +
  `/dadjoke - Get a random dad joke\n` +
  `/urban <term> - Look up a term on Urban Dictionary\n` +
  `/beat [time/@XXX] - Convert between .beat time and regular time\n` +
  `\n` +
  `*Utility Commands:*\n` +
  `/dt-search <query> - Search the web\n` +
  `/userinfo @user - Get user info\n` +
  `/dt-poll <question> - Create a poll\n` +
  `/dt-remind <task> - Set a reminder\n` +
  `/weather <city> - Get weather info\n` +
  `\n` +
  `*Tech Tools:*\n` +
  `/dns <domain> - DNS record lookup\n` +
  `/website <domain> - Website info\n` +
  `/disify <email> - Disposable email check\n` +
  `/ip <ip> - Get IP info\n` +
  `/errorid <code> - View HTTP cat for status code\n` +
  `\n` +
  `*Fun Commands:*\n` +
  `/song <name> - Search for a song\n` +
  `/axolotl - Random axolotl image\n` +
  `/catfact - Random cat fact\n` +
  `/dogfact - Random dog fact\n` +
  `\n` +
  `*Automatic Features:*\n` +
  `URLs in messages will generate previews with screenshots`;

await sendSlackMessage(env, channel, helpText, responseUrl);
}

async function handleSongSearch(song, env, channel, responseUrl = null) {
if (!song) {
  return sendSlackMessage(env, channel, 'Please provide a song name. Usage: `/song song name`', responseUrl);
}

await sendSlackMessage(env, channel, 
  `🎵 *Song Search:* ${song}\n` +
  `YouTube: https://www.youtube.com/results?search_query=${encodeURIComponent(song)}\n` +
  `Spotify: https://open.spotify.com/search/${encodeURIComponent(song)}`, responseUrl
);
}

async function handleIpLookup(ip, env, channel, responseUrl = null) {
if (!ip) {
  return sendSlackMessage(env, channel, 'Please provide an IP address. Usage: `/ip 1.1.1.1`', responseUrl);
}

try {
  const res = await fetch(`https://ipinfo.io/${ip}/json?token=${env.IPINFO_TOKEN || ''}`);
  const json = await res.json();
  
  if (json.error) {
    throw new Error(json.error.message);
  }
  
  await sendSlackMessage(env, channel, 
    `🌍 *IP Info for ${ip}:*\n` +
    `City: ${json.city || 'Unknown'}\n` +
    `Region: ${json.region || 'Unknown'}\n` +
    `Country: ${json.country || 'Unknown'}\n` +
    `Location: ${json.loc || 'Unknown'}\n` +
    `Organization: ${json.org || 'Unknown'}\n` +
    `Timezone: ${json.timezone || 'Unknown'}`, responseUrl
  );
} catch (error) {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    const json = await res.json();
    
    if (json.error) {
      throw new Error(json.reason);
    }
    
    await sendSlackMessage(env, channel, 
      `🌍 *IP Info for ${ip}:*\n` +
      `City: ${json.city || 'Unknown'}\n` +
      `Region: ${json.region || 'Unknown'}\n` +
      `Country: ${json.country_name || 'Unknown'}\n` +
      `ISP: ${json.org || 'Unknown'}`, responseUrl
    );
  } catch (fallbackError) {
    await sendSlackMessage(env, channel, 'IP lookup failed :( Please try again later.', responseUrl);
  }
}
}

async function sendAxolotl(env, channel, responseUrl = null) {
try {
  const unsplashToken = env.UNSPLASH_ACCESS_KEY;
  if (!unsplashToken) {
    throw new Error('Unsplash token not configured');
  }
  
  const res = await fetch('https://api.unsplash.com/photos/random?query=axolotl', {
    headers: {
      'Authorization': `Client-ID ${unsplashToken}`
    }
  });
  
  const json = await res.json();
  if (json && json.urls?.regular) {
    await sendSlackMessage(env, channel, `🦎 *Random Axolotl:*\n${json.urls.regular}`, responseUrl);
  } else {
    throw new Error('No image found');
  }
} catch (error) {
  const axolotlImages = [
    'https://c402277.ssl.cf1.rackcdn.com/photos/20852/images/magazine_medium/axolotl_WWsummer2021.jpg?1618758847',
    'https://images2.minutemediacdn.com/image/upload/c_crop,x_0,y_217,w_2115,h_1189/c_fill,w_1440,ar_1440:810,f_auto,q_auto,g_auto/images/voltaxMediaLibrary/mmsport/mentalfloss/01gwscsvw2yrt73s9sqj.jpg',
    'https://www.interactiveaquariumcancun.com/hubfs/Ajolote%20en%20acuario.jpg',
    'https://64.media.tumblr.com/91daa769ee35c0c9d88921eb7c0e0354/tumblr_n0038u3xLi1rdilhwo1_1280.jpg',
    'https://media.tenor.com/0JrWYOf9LmAAAAAM/axolotl-smile.gif'
  ];
  const randomImage = axolotlImages[Math.floor(Math.random() * axolotlImages.length)];
  await sendSlackMessage(env, channel, `🦎 *Random Axolotl:*\n${randomImage}`, responseUrl);
}
}

async function sendCatFact(env, channel, responseUrl = null) {
try {
  const res = await fetch('https://catfact.ninja/fact');
  const json = await res.json();
  await sendSlackMessage(env, channel, `🐱 *Cat Fact:* ${json.fact}`, responseUrl);
} catch (error) {
  await sendSlackMessage(env, channel, 'Failed to fetch cat fact :(', responseUrl);
}
}

async function sendDogFact(env, channel, responseUrl = null) {
try {
  const res = await fetch('https://dog-api.kinduff.com/api/facts');
  const json = await res.json();
  if (json && json.facts && json.facts.length > 0) {
    await sendSlackMessage(env, channel, `🐕 *Dog Fact:*\n${json.facts[0]}`, responseUrl);
  } else {
    throw new Error('No fact found');
  }
} catch (error) {
  const facts = [
    "Dogs' noses are wet to help them absorb scent chemicals.",
    "A dog's sense of smell is about 40 times greater than ours.",
    "Dogs can hear sounds up to 4 times farther than humans.",
    "Dogs have three eyelids, including one to keep their eyes moist.",
    "The average dog can run about 19 mph.",
    "Dogs can understand up to 250 words and gestures.",
    "A dog's nose print is unique, just like a human's fingerprint.",
    "Dogs can dream just like humans do.",
    "The Basenji is the only dog breed that can't bark.",
    "Dogs can see in color, but not as vividly as humans."
  ];
  const randomFact = facts[Math.floor(Math.random() * facts.length)];
  await sendSlackMessage(env, channel, `🐕 *Dog Fact:*\n${randomFact}`, responseUrl);
}
}

async function handleHttpCat(code, env, channel, responseUrl = null) {
if (!code) {
  return sendSlackMessage(env, channel, 'Please provide an HTTP status code. Usage: `/errorid 404`', responseUrl);
}

const validCodes = [100, 101, 200, 201, 202, 204, 206, 207, 300, 301, 302, 303, 304, 305, 307, 400, 401, 402, 403, 404, 405, 406, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 420, 421, 422, 423, 424, 425, 426, 429, 431, 444, 450, 451, 500, 502, 503, 504, 506, 507, 508, 509, 510, 511, 599];

if (!validCodes.includes(Number(code))) {
  return sendSlackMessage(env, channel, `Invalid HTTP status code. Try one of these:\n${validCodes.join(', ')}`, responseUrl);
}

await sendSlackMessage(env, channel, `🐱 *HTTP Cat ${code}:*\nhttps://http.cat/${code}`, responseUrl);
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

async function sendQuoteOfTheDay(env, channel, responseUrl = null) {
try {
  const apis = [
    'https://api.quotable.io/random',
    'https://quotes.rest/qod?category=inspire',
    'https://zenquotes.io/api/random'
  ];

  for (const api of apis) {
    try {
      const res = await fetch(api);
      const json = await res.json();
      
      let quote, author;
      
      if (api.includes('quotable')) {
        quote = json.content;
        author = json.author;
      } else if (api.includes('quotes.rest')) {
        quote = json.contents.quotes[0].quote;
        author = json.contents.quotes[0].author;
      } else if (api.includes('zenquotes')) {
        quote = json[0].q;
        author = json[0].a;
      }
      
      if (quote && author) {
        return sendSlackMessage(env, channel, `💬 *Quote of the Day:*\n> "${quote}" — *${author}*`, responseUrl);
      }
    } catch (error) {
      continue;
    }
  }
  
  sendSlackMessage(env, channel, 'Could not fetch quote of the day. Try again later.', responseUrl);
} catch (error) {
  sendSlackMessage(env, channel, 'Failed to fetch quote.', responseUrl);
}
}

async function getUserInfo(env, userId) {
const slackToken = env.SLACK_BOT_TOKEN;
const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
  headers: { 'Authorization': `Bearer ${slackToken}` },
});
const data = await res.json();

if (!data.ok) return 'User info not found :(';

const user = data.user;
return `👤 *User Info:*\n` +
  `Name: ${user.real_name}\n` +
  `Display Name: ${user.profile.display_name}\n` +
  `Title: ${user.profile.title || 'None'}\n` +
  `ID: ${user.id}\n` +
  `Time Zone: ${user.tz_label} (${user.tz})`;
}

async function sendUrbanDefinition(env, channel, term, responseUrl = null) {
if (!term) {
  return sendSlackMessage(env, channel, 'Please provide a term. Usage: `/urban term`', responseUrl);
}

try {
  const res = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
  const json = await res.json();
  
  if (json.list?.length > 0) {
    const topDef = json.list[0];
    const definition = topDef.definition.replace(/\[|\]/g, '');
    const example = topDef.example ? `*Example:*\n> ${topDef.example.replace(/\[|\]/g, '')}` : '';
    
    await sendSlackMessage(env, channel, 
      `📚 *Urban Dictionary: ${term}*\n` +
      `${definition}\n\n` +
      `${example}\n\n` +
      `👍 ${topDef.thumbs_up} 👎 ${topDef.thumbs_down}`, responseUrl
    );
  } else {
    await sendSlackMessage(env, channel, `No definition found for "${term}".`, responseUrl);
  }
} catch (error) {
  await sendSlackMessage(env, channel, 'Failed to fetch Urban Dictionary definition.', responseUrl);
}
}

async function sendTrivia(env, channel, responseUrl = null) {
try {
  const res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
  const json = await res.json();
  
  if (json.results?.length > 0) {
    const trivia = json.results[0];
    const question = decodeHtmlEntities(trivia.question);
    const correct = decodeHtmlEntities(trivia.correct_answer);
    const options = [...trivia.incorrect_answers.map(decodeHtmlEntities), correct]
      .sort(() => Math.random() - 0.5);
    
    await sendSlackMessage(env, channel, 
      `❓ *Trivia (${trivia.category} - ${trivia.difficulty}):*\n` +
      `${question}\n\n` +
      `*Options:* ${options.join(', ')}\n` +
      `_Answer: ||${correct}||_`, responseUrl
    );
  } else {
    await sendSlackMessage(env, channel, 'No trivia found.', responseUrl);
  }
} catch (error) {
  await sendSlackMessage(env, channel, 'Failed to fetch trivia.', responseUrl);
}
}

async function sendDadJoke(env, channel, responseUrl = null) {
try {
  const res = await fetch('https://icanhazdadjoke.com/', {
    headers: { 'Accept': 'application/json' },
  });
  const json = await res.json();
  await sendSlackMessage(env, channel, `😂 *Dad Joke:*\n${json.joke}`, responseUrl);
} catch (error) {
  await sendSlackMessage(env, channel, 'Failed to fetch dad joke, looks like the bot also does not like dad jokes', responseUrl);
}
}

async function handleBeatCommand(text, env, channel, responseUrl = null) {
  const args = text.split(/ +/g).filter(x => x);

  if (!args.length) {
      const now = new Date();
      const beat = getBMTBeatTime(now);

      await sendSlackMessage(env, channel, 
          `*Current Time:*\n` +
          `.beat time: ${beat}\n` +
          `UTC time: ${now.toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short',
              timeZone: 'UTC'
          })}`, responseUrl);
  } else if (args[0].startsWith('@') && args[0].length == 4) {
      const beat = args[0].slice(1);
      const b = parseInt(beat);

      if (isNaN(b)) {
          return await sendSlackMessage(env, channel, 
              `Invalid .beat time: ${args[0]}. Please use format @XXX where XXX is a number between 000 and 999.`, 
              responseUrl);
      }

      const ms = b * 86.4 * 1000;
      const now = new Date();
      const midnightToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), -1, 0, 0);
      const result = new Date(midnightToday + ms);

      await sendSlackMessage(env, channel,
          `*Beat Time Conversion:*\n` +
          `.beat time: ${args[0]}\n` +
          `UTC time: ${result.toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short',
              timeZone: 'UTC'
          })}`, responseUrl);
  } else {
      const timeString = args.join(' ');
      const date = new Date(timeString);

      if (isNaN(date.getTime())) {
          return await sendSlackMessage(env, channel,
              `Could not understand the time string: "${timeString}". Please use a valid time format or .beat time (@XXX).`,
              responseUrl);
      }

      const beat = getBMTBeatTime(date);

      await sendSlackMessage(env, channel,
          `*Time Conversion:*\n` +
          `.beat time: ${beat}\n` +
          `UTC time: ${date.toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short',
              timeZone: 'UTC'
          })}`, responseUrl);
  }
}