import {
  FullChannelResult, FullTeamResult, FullUserResult, PartialChannelResult, WebApiResultAny, WebClient,
} from "@slack/client"
import * as Bluebird from "bluebird"
import { IAddress, IConnector, IEvent, IMessage } from "botbuilder"
import * as qs from "qs"
import { OAuthAccessDeniedError, UnauthorizedError } from "./errors"
import * as http from "./http"
import * as interactors from "./interactors"
import { ISlackDataCache, ISlackInteractiveMessageEnvelope } from "./interfaces"
import * as utils from "./utils"

export interface ISlackAddress extends IAddress {
  id?: string
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
  dataCache?: ISlackDataCache
}

export class SlackConnector implements IConnector {
  private onEventHandler: (events: IEvent[], cb?: (err: Error) => void) => void
  // @ts-ignore
  private onInvokeHandler: (event: IEvent, cb?: (err: Error, body: any, status?: number) => void) => void
  private onDispatchEvents: (events: IEvent[], cb?: (events: IEvent[]) => void) => void

  constructor(protected settings: ISlackConnectorSettings) { }

  public listenOAuth() {
    return (req: http.IRequest, res: http.IResponse, next: () => void) => {
      new interactors.OAuthInteractor(this.settings, req.query)
        .call()
        .then((result) => {
          this.dispatchEvents(result.events)

          http.handleRedirectRequest(this.settings.onOAuthSuccessRedirectUrl, res, next)
        })
        .catch((error) => this.handleOAuthError(error, res, next))
    }
  }

  public listenCommands() {
    return (req: http.IRequest, res: http.IResponse, next: () => void) => {
      new interactors.CommandInteractor(this.settings, req.body)
        .call()
        .then((result) => {
          this.dispatchEvents(result.events)

          http.handleSuccessfulRequest(res, next, result.response)
        })
        .catch((error) => this.handleError(error, res, next))
    }
  }

  public listenInteractiveMessages() {
    return (req: http.IRequest, res: http.IResponse, next: () => void) => {
      const payload = JSON.parse(
        qs.parse(req.body).payload,
      ) as ISlackInteractiveMessageEnvelope

      new interactors.InteractiveMessageInteractor(this.settings, payload)
        .call()
        .then((result) => {
          this.dispatchEvents(result.events)

          http.handleSuccessfulRequest(res, next, result.response)
        })
        .catch((error) => this.handleError(error, res, next))
    }
  }

  public listenEvents() {
    return (req: http.IRequest, res: http.IResponse, next: () => void) => {
      new interactors.EventInteractor(this.settings, req.body)
        .call()
        .then((result) => {
          this.dispatchEvents(result.events)

          http.handleSuccessfulRequest(res, next, result.response)
        })
        .catch((error) => this.handleError(error, res, next))
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
    Bluebird.map<IMessage, IAddress>(
      messages, async (message, index, length) => {
        const address = message.address

        // Ignore endOfConversation. We can potencially call im.close on the future
        if (message.type === "endOfConversation") {
          return address
        }

        const { botId, teamId, channelId } = utils.decomposeConversationId(address.conversation.id)

        const client = await this.createClient(teamId)

        if ((!message.text || message.text === "") && !message.attachments) {
          throw new Error("Messages without content are not allowed.")
        } else {
          const slackMessage = utils.buildSlackMessage(message)
          const response     = await client.chat.postMessage(channelId, "", slackMessage)
          const conversation = utils.buildConversationIdentity(botId, teamId, channelId, response.ts)

          if (response.ok) {
            return {
              ...address,
              conversation,
              id: response.ts,
            }
          } else {
            throw new Error(response.message)
          }
        }
      },
      {
        concurrency: 1,
      },
    ).then((x) => cb(null, x), (err) => cb(err, null))
  }

  public startConversation(address: IAddress, cb: (err: Error, address?: IAddress) => void) {
    this.startDirectMessage(address.user.id)
      .then((d) => {
        const { botId, teamId } = utils.decomposeBotId(address.bot.id)
        const newAddress = {
          ...address,
          conversation: utils.buildConversationIdentity(botId, teamId, d.channel.id),
        }

        cb(null, newAddress)
      })
      .catch((err) => cb(err, null))
  }

  public update(message: IMessage, done: (err: Error, address?: IAddress) => void) {
    const address = message.address as ISlackAddress
    const { teamId, channelId } = utils.decomposeConversationId(address.conversation.id)

    this.createClient(teamId)
      .then(async (client) => {
        const slackMessage = utils.buildSlackMessage(message)
        const response = await client.chat.update(address.id, channelId, "", slackMessage)

        if (response.ok) {
          done(null, message.address)
        } else {
          done(new Error(response.error))
        }
      })
  }

  public delete(address: ISlackAddress, done: (err: Error) => void) {
    const { teamId, channelId } = utils.decomposeConversationId(address.conversation.id)

    this.createClient(teamId)
      .then(async (client) => {
        const response = await client.chat.delete(address.id, channelId)

        done(response.ok ? null : new Error(response.error))
      })
  }

  public async startDirectMessage(userId: string): Promise<WebApiResultAny> {
    const [slackUserId, teamId] = userId.split(":")

    const client = await this.createClient(teamId)

    return client
      .conversations
      .open({users: slackUserId})
  }

  public startReplyChain(message: IMessage): Promise<IAddress> {
    return new Promise((resolve, reject) => {
      this.send([message], (err, addresses) => {
        if (err) {
          reject(err)
        } else {
          resolve(addresses[0])
        }
      })
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

    return client.conversations
    .list()
    .then((r) => r.channels)
  }

  public async getMemberList(conversationId: string): Promise<FullUserResult[]> {
    const { teamId } = utils.decomposeConversationId(conversationId)
    const client = await this.createClient(teamId)

    const channel = await this.getChannel(conversationId)
    const members: string[] = (await client.conversations.members(channel.id)).members

    return Promise.all(members.map((id) => {
      return this.getUser(teamId, id)
    }))
  }

  public async getMember(address: IAddress): Promise<FullUserResult> {
    const [slackUserId, teamId] = address.user.id.split(":")

    return this.getUser(teamId, slackUserId)
  }

  public async getTeam(address: IAddress): Promise<FullTeamResult> {
    const { teamId } = utils.decomposeUserId(address.user.id)
    const client = await this.createClient(teamId)

    return (await client.team.info()).team
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

  private handleOAuthError(error: Error, res: http.IResponse, next: () => void) {
    if (error instanceof OAuthAccessDeniedError) {
      http.handleRedirectRequest(this.settings.onOAuthAccessDeniedRedirectUrl, res, next)
    } else {
      http.handleRedirectRequest(this.settings.onOAuthErrorRedirectUrl, res, next)
    }
  }

  private handleError(error: Error, res: http.IResponse, next: () => void) {
    if (error instanceof UnauthorizedError) {
      http.handleUnauthorizedRequest(res, next)
    } else {
      http.handleInternalError(res, next)
    }
  }

  private async getUser(teamId: string, slackUserId: string): Promise<FullUserResult> {
    return this.createClient(teamId)
      .then((x) => x.users.info(slackUserId).then((r) => r.user))
  }

  private async getChannel(conversationId: string): Promise<FullChannelResult> {
    const { teamId, channelId } = utils.decomposeConversationId(conversationId)

    const client = await this.createClient(teamId)

    return client
      .conversations
      .info(channelId)
      .then((r) => r.channel)
  }

  private async createClient(teamId?: string): Promise<WebClient> {
    const [token] = await this.settings.botLookup(teamId)

    return new WebClient(token)
  }
}
