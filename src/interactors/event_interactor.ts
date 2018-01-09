import { IEvent, Message } from "botbuilder"
import { Address } from "../address"
import * as constants from "../constants"
import { UnauthorizedError } from "../errors"
import { ConversationUpdateEvent, InstallationUpdateEvent } from "../events"
import {
  ISlackEvent, ISlackEventEnvelope, ISlackMemberJoinedChannelEvent, ISlackMemberLeftChannelEvent, ISlackMessageEvent,
} from "../interfaces"
import * as utils from "../utils"
import { BaseInteractor, IInteractorResult } from "./base_interactor"

export class EventInteractor extends BaseInteractor<ISlackEventEnvelope> {
  private get event(): ISlackEvent {
    return this.envelope.event as ISlackEvent
  }

  public async call(): Promise<IInteractorResult> {
    if (!utils.isValidEnvelope(this.envelope, this.settings.verificationToken)) {
      throw new UnauthorizedError()
    }

    if (this.envelope.type === "url_verification") {
      return { events: [], response: this.envelope.challenge }
    }

    if (this.envelope.type === "event_callback") {
      const [token, botId] = await this.settings.botLookup(this.envelope.team_id)

      const eventsToDispatch: IEvent[] = []

      // Skip events that are not routable
      if (!this.isRoutableEvent()) {
        return { events: [] }
      }

      if (this.isUserMessageEvent()) {
        eventsToDispatch.push(await this.buildMessageEvent(botId, token))
      } else if (this.isConversationUpdateEvent()) {
        eventsToDispatch.push(await this.buildConversationUpdateEvent(botId, token))
      } else if (this.isInstallationUpdateEvent()) {
        eventsToDispatch.push(await this.buildInstallationUpdateEvent(botId, token))
      } else {
        console.info("Unknown event received in SlackConnector. Ignoring...")
      }

      return { events: eventsToDispatch }
    }

    return { events: [] }
  }

  private async buildMessageEvent(botId: string, token: string): Promise<IEvent> {
    // FIXME: This is far from ideal. Temporary solution.
    const botUserId    = this.envelope.authed_users[0]
    const sourceEvent  = this.buildMessageSourceEvent(token)
    const botIdentity  = utils.decomposeUserId(botId)
    const userIdentity = await this.buildUser(botId, this.event.user)

    const address = new Address(botIdentity.teamId)
      .user(this.event.user, userIdentity.name)
      .bot(botIdentity.userId, this.settings.botName)
      .channel(this.event.channel)
      .thread(this.event.thread_ts)
      .id(this.event.event_ts)

    const messageEvent = this.event as ISlackMessageEvent
    const mentions = await utils.extractMentions({
      text: messageEvent.text,
      teamId: this.envelope.team_id,
      botId,
      botUserId,
      dataCache: this.settings.dataCache,
    })

    return new Message()
      .address(address.toAddress())
      .timestamp(messageEvent.ts)
      .sourceEvent(sourceEvent)
      .entities(mentions)
      .text(
        this.enrichText(messageEvent.text, botUserId, botId),
      )
      .toMessage()
  }

  private async buildInstallationUpdateEvent(botId: string, token: string): Promise<IEvent> {
    const botIdentity = utils.decomposeUserId(botId)

    const address = new Address(botIdentity.teamId)
      .user(botIdentity.userId, this.settings.botName)
      .bot(botIdentity.userId, this.settings.botName)

    return new InstallationUpdateEvent()
      .address(address.toAddress())
      .action("remove")
      .sourceEvent({
        SlackMessage: {
          ...this.event,
        },
        ApiToken: token,
      })
      .toEvent()
  }

  private async buildConversationUpdateEvent(botId: string, token: string): Promise<IEvent> {
    const botIdentity = utils.decomposeUserId(botId)

    const address = new Address(botIdentity.teamId)
      .bot(botIdentity.userId, this.settings.botName)
      .channel(this.envelope.event.channel.id || this.envelope.event.channel)

    const event = new ConversationUpdateEvent()
      .timestamp(this.event.event_ts)
      .sourceEvent({
        SlackMessage: {
          ...this.event,
        },
        ApiToken: token,
      })

    switch (this.event.type) {
      case "member_joined_channel": {
        const mjEvent = this.event as ISlackMemberJoinedChannelEvent
        const userIdentity = await this.buildUser(botId, mjEvent.user)

        event.membersAdded([userIdentity])

        address.user(mjEvent.user, userIdentity.name)

        break
      }
      case "member_left_channel": {
        const mlEvent = this.event as ISlackMemberLeftChannelEvent
        const userIdentity = await this.buildUser(botId, mlEvent.user)

        event.membersRemoved([userIdentity])
        address.user(mlEvent.user, userIdentity.name)

        break
      }
      default: {
        address.user(botIdentity.userId, this.settings.botName)
      }
    }

    return event.address(address.toAddress()).toEvent()
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

  private buildMessageSourceEvent(token: string) {
    return {
      slack: {
        SlackMessage: {
          ...this.envelope.event,
          team: this.envelope.team_id,
          source_team: this.envelope.team_id,
        },
        ApiToken: token,
      },
    }
  }

  private isRoutableEvent(): boolean {
    return this.isUserMessageEvent() ||
           this.isConversationUpdateEvent() ||
           this.isInstallationUpdateEvent()
  }

  private isConversationUpdateEvent(): boolean {
    return constants.CONVERSATION_UPDATE_EVENTS.includes(this.event.type)
  }

  private isInstallationUpdateEvent(): boolean {
    return constants.INSTALLATION_UPDATE_EVENTS.includes(this.event.type)
  }

  private isUserMessageEvent(): boolean {
    if (this.event.type === "message") {
      const messageEvent = this.event as ISlackMessageEvent

      // If event doesn't have a subtype it means it came from a user
      return !messageEvent.subtype
    }
  }
}
