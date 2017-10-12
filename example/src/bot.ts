import { UniversalBot, IConnector, IEvent, IIdentity } from "botbuilder"

export type BotCache = { [key: string]: { identity: IIdentity, token: string } }

export function createBot(connector: IConnector, botsCache: BotCache) {
  const bot = new UniversalBot(connector)

  bot.on('installationUpdate', (event: IEvent) => {
    console.info(`New bot installed by ${event.sourceEvent.SlackMessage.user_id}`)

    botsCache[event.sourceEvent.SlackMessage.team_id] = {
      identity: event.address.bot,
      token: event.sourceEvent.ApiToken
    }
  })

  bot.on('conversationUpdate', (event: IEvent) => {
    console.info(`New conversation update event received:`)
    console.info(event)
  })

  bot.on('slackCommand', (event: IEvent) => {
    console.info(`New slack command received:`)
    console.info(event)
  })

  bot.dialog('/', (session) => {
    session.endDialog('pong')
  })
}
