import {
  AuthAccessResult, FullChannelResult, FullUserResult, ImOpenResult, PartialChannelResult, WebClient,
} from "@slack/client"
import * as Bluebird from "bluebird"
import { IAddress, IConnector, IConversationUpdate, IEvent, IMessage, Message } from "botbuilder"
import * as qs from "qs"
import { Request, Response } from "restify"
import * as utils from "./utils"

export interface ISlackAddress extends IAddress {
  id: string
}

export interface ISlackConnectorSettings {
  botLookup: (teamId: string) => Promise<[string, string]>
  botName: string
  verificationToken: string
  clientId: string
  clientSecret: string
  redirectUrl: string
  onOAuthSuccessRedirectUrl: string
  onOAuthErrorRedirectUrl: string
  onOAuthAccessDeniedRedirectUrl: string
}

function handleUnauthorizedRequest(res: Response, next: () => void) {
  res.status(403)
  res.end()
  next()
}

function handleSuccessfulRequest(res: Response, next: () => void, data?: string) {
  res.status(200)
  res.end(data)
  next()
}

function handleRedirectRequest(url: string, res: Response, next: () => void) {
  res.header("Location", url)
  res.status(302)
  res.end()
  next()
}

export class SlackConnector implements IConnector {
  private onEventHandler: (events: IEvent[], cb?: (err: Error) => void) => void
  private onInvokeHandler: (event: IEvent, cb?: (err: Error, body: any, status?: number) => void) => void
  private onDispatchEvents: (events: IEvent[], cb?: (events: IEvent[]) => void) => void

  constructor(protected settings: ISlackConnectorSettings) { }

  public listenOAuth() {
    return (req: Request, res: Response, next: () => void) => {
      const error = req.query.error

      if (error === "access_denied") {
        return handleRedirectRequest(this.settings.onOAuthAccessDeniedRedirectUrl, res, next)
      }

      const code = req.query.code

      this.createClient()
        .then(async (c) => {
          try {
            const result = await c.oauth.access(
              this.settings.clientId,
              this.settings.clientSecret,
              code,
              { redirect_uri: this.settings.redirectUrl },
            )

            const event = await this.buildInstallationUpdateEvent(result)

            console.info(event)

            this.dispatchEvents([event])

            handleRedirectRequest(this.settings.onOAuthSuccessRedirectUrl, res, next)
          } catch (e) {
            return handleRedirectRequest(this.settings.onOAuthErrorRedirectUrl, res, next)
          }
      })
    }
  }

  public listenCommands() {
    return (req: Request, res: Response, next: () => void) => {
      const envelope: ISlackCommandEnvelope = req.params

      if (!this.isValidCommand(envelope)) {
        return handleUnauthorizedRequest(res, next)
      }

      this.settings.botLookup(envelope.team_id)
      .then(([token, botIdentifier]) => {
        const event = utils.buildCommandEvent(envelope, token, botIdentifier, this.settings.botName)

        this.dispatchEvents([event])

        return handleSuccessfulRequest(res, next)
      })
    }
  }

  public listenInteractiveMessages() {
    return (req: Request, res: Response, next: () => void) => {
      const payload = JSON.parse(
        qs.parse(req.body).payload,
      ) as ISlackInteractiveMessageEnvelope

      if (!this.isValidInteractiveMessage(payload)) {
        return handleUnauthorizedRequest(res, next)
      }

      this.settings.botLookup(payload.team.id)
      .then(([token, botIdentifier]) => {
        const address = utils.buildAddress(
          payload.team.id,
          payload.user.id,
          payload.channel.id,
          botIdentifier,
          this.settings.botName,
          payload.message_ts,
        )

        const sourceEvent = utils.buildInteractiveMessageSourceEvent(payload, token)

        const message = new Message()
          .address(address)
          .timestamp(payload.action_ts)
          .sourceEvent(sourceEvent)
          .text(payload.actions[0].value)

        this.dispatchEvents([
          {
            ...message.toMessage(),
            user: address.user,
          } as IMessage,
        ])

        return handleSuccessfulRequest(res, next)
      })
    }
  }

  public listenEvents() {
    return (req: Request, res: Response, next: () => void) => {
      const envelope: ISlackEventEnvelope = req.body

      if (!this.isValidEvent(envelope)) {
        return handleUnauthorizedRequest(res, next)
      }

      if (envelope.type === "url_verification") {
        return handleSuccessfulRequest(res, next, envelope.challenge)
      } else if (envelope.type === "event_callback") {
        this.settings.botLookup(envelope.team_id)
        .then(([token, botIdentifier]) => {
          this.dispatch(envelope, botIdentifier, token)

          return handleSuccessfulRequest(res, next)
        })
      } else {
        return handleSuccessfulRequest(res, next)
      }
    }
  }

  public onEvent(handler: (events: IEvent[], cb?: (err: Error) => void) => void) {
    this.onEventHandler = handler
  }

  public onInvoke(handler: (event: IEvent, cb?: (err: Error, body: any, status?: number) => void) => void) {
    this.onInvokeHandler = handler
  }

  public onDispatch(handler: (events: IEvent[], cb?: (events: IEvent[]) => void) => void) {
    this.onDispatchEvents = handler
  }

  public send(messages: IMessage[], cb: (err: Error, addresses?: IAddress[]) => void) {
    Bluebird.map<IMessage, IAddress>(messages, async (message, index, length) => {
      const address = message.address

      // Ignore endOfConversation. We can potencially call im.close on the future
      if (message.type === "endOfConversation") {
        return address
      }

      const { team, channel } = utils.decomposeConversationId(address.conversation.id)

      const client = await this.createClient(team)

      if ((!message.text || message.text === "") && !message.attachments) {
        throw new Error("Messages without content are not allowed.")
      } else {
        const slackMessage = utils.buildSlackMessage(channel, message)
        const response = await client.chat.postMessage(channel, "", slackMessage)

        if (response.ok) {
          return {
            id: response.ts,
            ...address,
          }
        } else {
          throw new Error(response.message)
        }
      }
    }, { concurrency: 1 })
    .then((x) => cb(null, x))
    .catch((err) => cb(err, null))
  }

  public startConversation(address: IAddress, cb: (err: Error, address?: IAddress) => void) {
    this.startDirectMessage(address.user.id)
      .then((d) => {
        const newAddress = { ...address, conversation: { id: d.channel.id } }

        cb(null, newAddress)
      })
      .catch((err) => cb(err, null))
  }

  public update(message: IMessage, done: (err: Error, address?: IAddress) => void) {
    const address = message.address as ISlackAddress
    const { team, channel } = utils.decomposeConversationId(address.conversation.id)

    this.createClient(team)
      .then((client) => {
        // TODO: Support updating full messages
        client.chat.update(address.id, channel, message.text)
      })
  }

  public delete(address: ISlackAddress, done: (err: Error) => void) {
    const { team, channel } = utils.decomposeConversationId(address.conversation.id)

    this.createClient(team)
      .then((client) => {
        client.chat.delete(address.id, channel)
      })
  }

  public async getGeneralConversation(teamId: string): Promise<PartialChannelResult> {
    const client = await this.createClient(teamId)

    return client
      .channels
      .list()
      .then((r) => r.channels.filter((c) => c.is_general)[0])
  }

  public async getConversation(conversationId: string, teamId: string): Promise<FullChannelResult> {
    return this.getChannel(conversationId)
  }

  public async getConversationList(teamId: string): Promise<PartialChannelResult[]> {
    const client = await this.createClient(teamId)

    return Promise.all([
      client.channels.list().then((r) => r.channels),
      client.groups.list().then((r) => r.groups),
    ])
    .then(([channels, groups]) => channels.concat(groups))
  }

  public async getMemberList(conversationId: string): Promise<FullUserResult[]> {
    const { team } = utils.decomposeConversationId(conversationId)

    const channel = await this.getChannel(conversationId)

    return Promise.all(channel.members.map((id) => {
      return this.getUser(team, id)
    }))
  }

  public async getMember(address: IAddress): Promise<FullUserResult> {
    const [slackUserId, teamId] = address.user.id.split(":")

    return this.getUser(teamId, slackUserId)
  }

  public async startDirectMessage(userId: string): Promise<ImOpenResult> {
    const [slackUserId, teamId] = userId.split(":")

    const client = await this.createClient(teamId)

    return client.im.open(slackUserId)
  }

  private dispatch(envelope: ISlackEventEnvelope, botId: string, token: string): void {
    const eventsToDispatch: IEvent[] = []
    const event = envelope.event as ISlackEvent

    // Skip events that are not routable
    if (!utils.isRoutableEvent(event)) { return }

    if (utils.isUserMessageEvent(event)) {
      eventsToDispatch.push(this.buildMessageEvent(envelope, botId, token))
    } else if (utils.isConversationUpdateEvent(event)) {
      eventsToDispatch.push(this.buildConversationUpdateEvent(envelope, botId, token))
    } else {
      console.info("Unknown event received in SlackConnector. Ignoring...")
    }

    this.dispatchEvents(eventsToDispatch)
  }

  private dispatchEvents(events: IEvent[]) {
    if (events.length > 0) {
      if (this.onDispatchEvents) {
        this.onDispatchEvents(events, (transforedEvents) => {
          this.onEventHandler(transforedEvents)
        })
      } else {
        this.onEventHandler(events)
      }
    }
  }

  private buildMessageEvent(envelope: ISlackEventEnvelope, botId: string, token: string): IEvent {
    const event = envelope.event as ISlackMessageEvent
    // FIXME: This is far from ideal. Temporary solution.
    const botUserId = envelope.authed_users[0]
    const sourceEvent = utils.buildMessageSourceEvent(envelope, token)

    const address = utils.buildAddress(
      envelope.team_id,
      event.user,
      event.channel,
      botId,
      this.settings.botName,
      event.event_ts,
    )

    const mentions = utils.extractMentions(event.text, envelope.team_id, botId, botUserId)

    const message = new Message()
      .address(address)
      .timestamp(event.ts)
      .sourceEvent(sourceEvent)
      .entities(mentions)
      .text(
        this.enrichText(event.text, botUserId, botId),
      )

    return {
      ...message.toMessage(),
      user: address.user,
    } as IEvent
  }

  private enrichText(text: string, botUserId: string, botId: string): string {
    const pattern = `<@${botUserId}>`
    const botMention = `@${this.settings.botName}`

    const matches = text.match(new RegExp(pattern, "gi"))

    if (!matches) { return text }

    return matches.reduce((x) => {
      return text.replace(pattern, botMention)
    }, text)
  }

  private async buildInstallationUpdateEvent(accessResult: AuthAccessResult): Promise<IEvent> {
    const bot = await (new WebClient(accessResult.access_token).users.info(accessResult.bot.bot_user_id))
    console.info(bot)
    const user = utils.buildUserIdentity(accessResult.user_id, accessResult.team_id)

    const address = {
      channelId: "slack",
      user,
      bot: utils.buildBotIdentity(
        utils.buildUserIdentity(bot.user.profile.bot_id, accessResult.team_id).id,
        bot.user.name,
      ),
    }

    // Remove the ok key
    delete accessResult.ok

    return {
      type: "installationUpdate",
      source: "slack",
      agent: "botbuilder",
      sourceEvent: {
        SlackMessage: {
          ...accessResult,
        },
        ApiToken: accessResult.bot.bot_access_token,
      },
      address,
      user,
    }
  }

  private buildConversationUpdateEvent(envelope: ISlackEventEnvelope, botId: string, token: string): IEvent {
    const address = utils.buildAddress(
      envelope.team_id,
      "", // FIXME: We are setting the user in the switch
      envelope.event.channel,
      botId,
      this.settings.botName,
    )

    let event: any = {
      type: "conversationUpdate",
      source: "slack",
      agent: "botbuilder",
      text: "",
      timestamp: envelope.event.event_ts,
      sourceEvent: {
        SlackMessage: {
          ...envelope.event,
        },
        ApiToken: token,
      },
    }

    switch (envelope.event.type) {
      case "member_joined_channel": {
        const mjEvent = envelope.event as ISlackMemberJoinedChannelEvent
        const newUser = utils.buildUserIdentity(mjEvent.user, envelope.team_id)
        event = {
          ...event,
          membersAdded: [ newUser ],
        }
        address.user = newUser

        break
      }
      case "member_left_channel": {
        const mlEvent = envelope.event as ISlackMemberLeftChannelEvent
        const newUser = utils.buildUserIdentity(mlEvent.user, envelope.team_id)
        event = {
          ...event,
          membersRemoved: [ newUser ],
        }
        address.user = newUser

        break
      }
      default: {
        address.user = address.bot
      }
    }

    return {
      ...event,
      address,
      user: address.user,
    } as IConversationUpdate
  }

  private isValidEvent(envelope: ISlackEventEnvelope): boolean {
    return envelope.token === this.settings.verificationToken
  }

  private isValidInteractiveMessage(envelope: ISlackInteractiveMessageEnvelope): boolean {
    return envelope.token === this.settings.verificationToken
  }

  private isValidCommand(envelope: ISlackCommandEnvelope): boolean {
    return envelope.token === this.settings.verificationToken
  }

  private async getUser(teamId: string, slackUserId: string): Promise<FullUserResult> {
    return this.createClient(teamId)
      .then((x) => x.users.info(slackUserId).then((r) => r.user))
  }

  private async getChannel(conversationId: string): Promise<FullChannelResult> {
    const { team, channel } = utils.decomposeConversationId(conversationId)

    const client = await this.createClient(team)

    switch (channel[0]) {
      case "C":
        return client.channels.info(channel).then((r) => r.channel)
      case "G":
        return client.groups.info(channel).then((r) => r.group)
    }
  }

  private async createClient(teamId?: string): Promise<WebClient> {
    if (teamId) {
      const [token] = await this.settings.botLookup(teamId)

      return new WebClient(token)
    }

    return new WebClient()
  }
}
