#  Building Your Own Slack Bot Tutorial

Heya! So you want to make your own slack bot? cool! This tutorial will help you get started. it's not that hard, trust me :)

## Prerequisites

Before we start, you'll need:
- A [cloudflare](https://cloudflare.com) account (it's free)
- A [slack workspace](https://slack.com) (like hackclub)
- Some basic javascript knowledge (if you don't know js, go learn it first)
- A code editor (vscode is pretty cool)

## Setting Up Your Bot

### 1. Create a Slack App
1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From scratch"
4. Name your bot (make it cool)
5. Select your workspace

### 2. Get Your Bot Tokens
1. In your app settings, go to "OAuth & Permissions"
2. Scroll down to "Scopes"
3. Add these bot token scopes:
   - `chat:write`
   - `commands`
   - `users:read`
   - `users:read.email`
4. Install the app to your workspace
5. Copy the "Bot User OAuth Token" (starts with `xoxb-`)

### 3. Set Up Cloudflare Workers
1. Go to [workers.cloudflare.com](https://workers.cloudflare.com)
2. Create a new worker
3. Copy the code from `base.js` into your worker
4. Add your environment variables:
   - `SLACK_BOT_TOKEN`: your bot token
   - `SLACK_SIGNING_SECRET`: from your slack app settings

## Understanding the Code

### Basic Structure
```javascript
// this is where you handle slash commands
async function handleSlackEvent(event) {
  const command = event.command;
  
  switch(command) {
    case '/your-command':
      // your code here
      break;
  }
}

// this is where you handle button clicks and stuff
async function handleSlackInteraction(event) {
  const action = event.actions[0];
  
  switch(action.action_id) {
    case 'your-action':
      // your code here
      break;
  }
}
```

### Making API Calls
```javascript
// example of calling an api
async function callSomeAPI() {
  const response = await fetch('https://api.example.com/data');
  const data = await response.json();
  return data;
}
```

### Sending Messages
```javascript
// example of sending a message
async function sendMessage(channel, text) {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel: channel,
      text: text
    })
  });
}
```

## Adding New Commands

### 1. Update app_manifest.yaml
Add your new command to the manifest:
```yaml
slash_commands:
  - command: /your-command
    description: what your command does
    usage_hint: how to use it
```

### 2. Add Command Handler
In your code:
```javascript
case '/your-command':
  // your command logic here
  return {
    response_type: 'in_channel',
    text: 'your response'
  };
```

## Useful APIs to Try

Here are some cool free apis you can use:

### Essential APIs
- [quotable](https://quotable.io) - for quotes
- [openweathermap](https://openweathermap.org) - for weather
- [ipinfo](https://ipinfo.io) - for ip lookups
- [unsplash](https://unsplash.com) - for images
- [jokeapi](https://jokeapi.dev) - for jokes

### Fun APIs
- [The Cat API](https://thecatapi.com) - random cat pics
- [Chuck Norris Jokes](https://api.chucknorris.io) - chuck norris facts
- [Buddha Quotes](https://buddha-api.com) - zen wisdom
- [Ron Swanson Quotes](https://ron-swanson-quotes.herokuapp.com) - parks & rec quotes

### Utility APIs
- [The Color API](https://thecolorapi.com) - color conversions
- [HTML Creator](https://html-creator-api.com) - generate html
- [LeakCheck](https://leakcheck.io) - check email breaches
- [The Rosary API](https://rosary-api.com) - daily prayers
- [Jelly Belly Wiki](https://jellybelly-api.com) - jelly bean facts

### API Resources
- [Free Public APIs](https://www.freepublicapis.com) - huge collection of free APIs
- [APILayer](https://apilayer.com) - premium APIs with free tiers
- [Free APIs GitHub](https://free-apis.github.io) - curated list of free APIs

### Example API Integration
```javascript
// example of using multiple apis
async function getRandomStuff() {
  // get a random cat
  const catResponse = await fetch('https://api.thecatapi.com/v1/images/search');
  const catData = await catResponse.json();
  
  // get a random quote
  const quoteResponse = await fetch('https://api.quotable.io/random');
  const quoteData = await quoteResponse.json();
  
  // get a random color
  const colorResponse = await fetch('https://www.thecolorapi.com/random');
  const colorData = await colorResponse.json();
  
  return {
    cat: catData[0].url,
    quote: quoteData.content,
    color: colorData.hex.value
  };
}
```

## Debugging Tips

1. Use `console.log()` everywhere (it shows up in cloudflare logs)
2. Check the network tab in your browser dev tools
3. Use [slack's block kit builder](https://app.slack.com/block-kit-builder) to test message layouts
4. Test your commands in a private channel first

## Learning Resources

- [slack api docs](https://api.slack.com) (kinda boring but useful)
- [cloudflare workers docs](https://developers.cloudflare.com/workers) (pretty good)
- [javascript.info](https://javascript.info) (if you need to learn js)

## Next Steps

1. Start with simple commands
2. Add buttons and interactions
3. Try using different apis
4. Add error handling
5. Make your bot more interactive

## Common Issues

- "invalid token" - check your bot token
- "command not found" - make sure you added it to the manifest
- "permission denied" - check your bot scopes
- "rate limited" - you're making too many requests, slow down

## Making Your Bot Cool

- Add emojis to your messages
- Use [block kit](https://api.slack.com/block-kit) for better layouts
- Add interactive buttons
- Use modals for complex inputs

## Final Notes

- Keep your tokens secret (if not i bet someone will nuke your workspace or something)
- Use environment variables for sensitive stuff like api keys
- Test everything before deploying
- Have fun with it!

---

Need help? just ask in the [#thunder channel](https://hackclub.slack.com/archives/C06V2GEV3MY) channel or dm [me@sdheeraj.is-cool.dev](mailto:me@sdheeraj.is-cool.dev)