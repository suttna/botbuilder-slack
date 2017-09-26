![Logo](logo.png)

# botbuilder-slack [![npm version](https://badge.fury.io/js/botbuilder-slack.svg)](https://badge.fury.io/js/botbuilder-slack) [![CircleCI](https://circleci.com/gh/suttna/botbuilder-slack.svg?style=svg)](https://circleci.com/gh/suttna/botbuilder-slack) [![Join the chat at https://gitter.im/suttna/botbuilder-slack](https://badges.gitter.im/suttna/botbuilder-slack.svg)](https://gitter.im/suttna/botbuilder-slack?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

⚠️  **This is under development. If you want to help 🚀, please contact the Suttna team at opensource@suttna.com**

Slack connector for Microsoft BotBuilder.

This connector was created at [Suttna](https://suttna.com) to tackle some of the limitations of BotFramework's current Slack connector.

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

## Configuration

In order to use all the connector features you will need to configure Slack's Event Subscriptions and Slack's Interactive messages.

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

## Usage

```javascript
var restify = require('restify')
var builder = require('botbuilder')
var botbuilderSlack = require('botbuilder-slack')

// This is how the connector is able to get the slack authorization token. You need to be
// able to fetch the authorization token for an account based on the team id (`TXXXXX`)
var botLookup = (teamId) => {
  return repositories.account.findBy({ externalId: teamId })
    .then(slackAccount => [slackAccount.slackApiToken, slackAccount.botId])
}

var connector = new builder.SlackConnector({
  botLookup: botLookup,
  botName: 'suttna',
  verificationToken: 'XXX'
})

var bot = new builder.UniversalBot()

// This will make the SlackConnector work only for messages that have 'slack' as the channelId
bot.connector('slack', connector)

// Attach listener for events. You need to configure this url in Slack website
server.post('/slack/events', connector.listenEvents())

// Attach listener for interactive messages. You need to configure this url in Slack website
server.post('/slack/interactive', connector.listenInteractiveMessages())

// Attach listener for interactive messages. You need to configure this url in Slack website
server.post('/slack/commands', connector.listenCommands())
```

## Help

If you want to help on improving this connector, adding more features and trying to standardize how bots communicate, please contact us at opensource@suttna.com.

Thanks!

## Contact

- Martín Ferández <martin@suttna.com>
- Santiago Doldán <santiago@suttna.com>
