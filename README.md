![Logo](logo.png)

# botbuilder-slack [![npm version](https://badge.fury.io/js/botbuilder-slack.svg)](https://badge.fury.io/js/botbuilder-slack) [![CircleCI](https://circleci.com/gh/suttna/botbuilder-slack.svg?style=svg)](https://circleci.com/gh/suttna/botbuilder-slack) [![codecov](https://codecov.io/gh/suttna/botbuilder-slack/branch/master/graph/badge.svg)](https://codecov.io/gh/suttna/botbuilder-slack) [![Join the chat at https://gitter.im/suttna/botbuilder-slack](https://badges.gitter.im/suttna/botbuilder-slack.svg)](https://gitter.im/suttna/botbuilder-slack?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Slack connector for Microsoft BotBuilder.

This connector was created at [Suttna](https://suttna.com) to tackle some of the limitations of BotFramework's current Slack connector.

‼️‼️**For FULL BotFramework's connector compatibility use botbuilder-slack@1.1.1**‼️‼️

## Features

### OAuth

By using this connector you will be communicating with Slack directly. You are in total control of the OAuth process. This opens the possibility of knowing what user has installed the bot for example.

### Speed

Their is no middleman that intercepts the messages. You are connected directly to slack so you can expect faster response/delivery times.

### Formatting

For a long time the Slack markdown formatting has been broken in botframework. Now you are able to use the Slack formatting rules to customize your messages.

### Events

The current implementation of BotFramework limits the events that you can receive, not all of them are implemented. Now you can expect the following events to be handled correctly:

- channel_archive
- channel_created
- channel_deleted
- channel_rename
- channel_unarchive
- group_archive
- group_rename
- group_unarchive
- member_joined_channel
- member_left_channel

> Note: All this events are emitted as conversationUpdate events. Be careful with the user property of the address. For `member_joined_channel` and `member_left_channel` the user in the address is the user that joined or left the channel. For the other events the user is the bot for the moment.

### Commands

You can setup slack commands and use them with your bot. When configuring commands, your bot will emit a new event with type `slackCommand`.

## Compatibility

The idea of the initial implementation is that you can easily migrate from running Slack with BotFramework. This connector is almost 100% compatible. A few small but important differences:

### isGroup

BotFramework's Slack connector marks the property `address.conversation.isGroup` to true if more than one user is in the conversation. At the moment, the connector does not have a cache or extension point to query this information. `isGroup` property will be true if the communication is happening in a public or private channel. For direct messages the property will be false.

### Mentions

At the moment, the mentions that are loaded in the entities property of a message will not have the user's name. This is because Slack is not sending this information any longer in the mention itself. We will solve this problem soon.

## Install

```
yarn add botbuilder-slack
```

To run the code in master branche:

```
yarn add botbuilder-slack@next
```

## Configuration

In order to use all the connector features you will need to configure Slack's OAuth, Slack's Event Subscriptions, Slack's Interactive messages and Slack's commands. Configure only the options that your bot is going to use.

### OAuth

You need to setup the base URL where your bot is going to handle the OAuth process. Check the connector constructor settings for more information on the available options.

After a user has installed the bot, `installationUpdate` event is going to be emitted. The address will contain the installer information in the sourceEvent. The address will set the user property as the bot to be compatible with BotFramework. The sourceEvent in this case will be the response from calling Slack's api method `oauth.access`.

### Event Subscriptions

You need to setup a URL that will listen for this events. Look at the usage example to have a better understanding. The complete list of events that you need to register are the following:

- message.channels
- message.groups
- message.im
- message.mpim
- channel_archive
- channel_deleted
- channel_rename
- channel_unarchive
- group_archive
- group_rename
- group_unarchive
- member_joined_channel
- member_left_channel

### Interactive Messages

You need to setup a URL that will listen for interactive message callbacks. Look at the usage example to have a better understanding.

### Commands

You need to setup a URL that will listen for commands. Look at the usage example to have a better understanding.

### Threads

By default, replies to user's messages are threaded. This means that if you want to have an unthreaded conversation with a user you will need to manually change the address. This mimics what Microsoft Teams does. A conversation id will look like this `BXXX:TXXX:CXXX;messageid=123456`.

```javascript
bot.dialog("/", (session) => {
  session.message.address.conversation.id = session.message.address.conversation.id.split(";")[0]

  session.endDialog("Am I in a thread?") // No, this created a separate message
})
```

### Data Cache

If you want to enrich the data the connector sends to your bot, you can provide a `ISlackDataCache`. At the
moment the data cache is only used for:

- Adding the user's name in the address
- Adding the user's name to a mention.

## Usage

```javascript
import * as restify from 'restify'
import { UniversalBot, IEvent, IIdentity } from "botbuilder"
import { SlackConnector } from "botbuilder-slack"

type BotCache = { [key: string]: { identity: IIdentity, token: string } }

const botsCache: BotCache = {}

const connectorSettings = {
  botLookup: (teamId: string) => {
    const botEntry = botsCache[teamId]

    if (botEntry) {
      return Promise.resolve([botEntry.token, botEntry.identity.id] as [string, string])
    } else {
      return Promise.reject(new Error('Bot not found'))
    }
  },
  botName: process.env.SLACK_BOT_NAME,
  verificationToken: process.env.SLACK_VERIFICATION_TOKEN,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  redirectUrl: process.env.SLACK_OAUTH_REDIRECT_URL,
  onOAuthSuccessRedirectUrl: process.env.SLACK_OAUTH_ON_SUCCESS_REDIRECT_URL,
  onOAuthErrorRedirectUrl: process.env.SLACK_OAUTH_ON_ERROR_REDIRECT_URL,
  onOAuthAccessDeniedRedirectUrl: process.env.SLACK_OAUTH_ON_ACCESS_DENIED_REDIRECT_URL
}

const connector = new SlackConnector(connectorSettings)

const bot = new UniversalBot(connector)
const app = restify.createServer()

app.use(restify.plugins.queryParser())
app.use(restify.plugins.bodyParser())

bot.on('installationUpdate', (event: IEvent) => {
  console.info(`New bot installed by ${event.sourceEvent.SlackMessage.user_id}`)

  botsCache[event.sourceEvent.SlackMessage.team_id] = {
    identity: event.address.bot,
    token: event.sourceEvent.ApiToken
  }
})

bot.dialog('/', (session) => {
  session.endDialog('pong')
})

app.listen(3000, () => {
  console.log("Bot is listening...")
})

app.post('/slack/events', connector.listenEvents())
app.post('/slack/interactive', connector.listenInteractiveMessages())
app.post('/slack/command', connector.listenCommands())
app.get('/slack/oauth', connector.listenOAuth())
```

## Examples

Take a look at the prebuilt example for more information [here](example/README.md).

## Documentation

You can find the documentation reference [here](https://suttna.github.io/botbuilder-slack/).

## Help

If you want to help on improving this connector, adding more features and trying to standardize how bots communicate, please contact us at opensource@suttna.com.

Thanks!

## Contact

- Martín Ferández <martin@suttna.com>
- Santiago Doldán <santiago@suttna.com>
