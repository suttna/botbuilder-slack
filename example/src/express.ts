import * as express from "express"
import * as bodyParser from "body-parser"
import { SlackConnector } from "botbuilder-slack"
import { createBot, BotCache } from "./bot"

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

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded())

app.listen(3000, () => {
  console.log("Bot is listening...")
})

app.post('/slack/events', connector.listenEvents())
app.post('/slack/interactive', connector.listenInteractiveMessages())
app.post('/slack/command', connector.listenCommands())
app.get('/slack/oauth', connector.listenOAuth())

createBot(connector, botsCache)
