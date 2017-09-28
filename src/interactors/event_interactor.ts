import { IConversationUpdate, IEvent, Message } from "botbuilder"
import { CONVERSATION_UPDATE_EVENTS } from "../constants"
import { UnauthorizedError } from "../errors"
import { ISlackConnectorSettings } from "../slack_connector"
import * as utils from "../utils"
import { IInteractorResult } from "./"

export class EventInteractor {

  constructor(private settings: ISlackConnectorSettings, private envelope: ISlackEventEnvelope) { }

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
        eventsToDispatch.push(this.buildMessageEvent(botId, token))
      } else if (this.isConversationUpdateEvent()) {
        eventsToDispatch.push(this.buildConversationUpdateEvent(botId, token))
      } else {
        console.info("Unknown event received in SlackConnector. Ignoring...")
      }

      return { events: eventsToDispatch }
    }

    return { events: [] }
  }

  private buildMessageEvent(botId: string, token: string): IEvent {
    // FIXME: This is far from ideal. Temporary solution.
    const botUserId = this.envelope.authed_users[0]
    const sourceEvent = this.buildMessageSourceEvent(token)

    const address = utils.buildAddress(
      this.envelope.team_id,
      this.event.user,
      this.event.channel,
      botId,
      this.settings.botName,
      this.event.event_ts,
    )

    const messageEvent = this.event as ISlackMessageEvent
    const mentions = utils.extractMentions(messageEvent.text, this.envelope.team_id, botId, botUserId)

    const message = new Message()
      .address(address)
      .timestamp(messageEvent.ts)
      .sourceEvent(sourceEvent)
      .entities(mentions)
      .text(
        this.enrichText(messageEvent.text, botUserId, botId),
      )

    return {
      ...message.toMessage(),
      user: address.user,
    } as IEvent
  }

  private buildConversationUpdateEvent(botId: string, token: string): IEvent {
    const address = utils.buildAddress(
      this.envelope.team_id,
      "", // FIXME: We are setting the user in the switch
      this.envelope.event.channel,
      botId,
      this.settings.botName,
    )

    let event: any = {
      type: "conversationUpdate",
      source: "slack",
      agent: "botbuilder",
      text: "",
      attachments: [],
      entities: [],
      timestamp: this.event.event_ts,
      sourceEvent: {
        SlackMessage: {
          ...this.event,
        },
        ApiToken: token,
      },
    }

    switch (this.event.type) {
      case "member_joined_channel": {
        const mjEvent = this.event as ISlackMemberJoinedChannelEvent
        const newUser = utils.buildUserIdentity(mjEvent.user, this.envelope.team_id)
        event = {
          ...event,
          membersAdded: [ newUser ],
        }
        address.user = newUser

        break
      }
      case "member_left_channel": {
        const mlEvent = this.event as ISlackMemberLeftChannelEvent
        const newUser = utils.buildUserIdentity(mlEvent.user, this.envelope.team_id)
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
    return this.isUserMessageEvent() || this.isConversationUpdateEvent()
  }

  private isConversationUpdateEvent(): boolean {
    return CONVERSATION_UPDATE_EVENTS.includes(this.event.type)
  }

  private isUserMessageEvent(): boolean {
    if (this.event.type === "message") {
      const messageEvent = this.event as ISlackMessageEvent

      // If event doesn't have a subtype it means it came from a user
      return !messageEvent.subtype
    }
  }
}
