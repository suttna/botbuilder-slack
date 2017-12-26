import { IEvent, IIdentity, IMessage, Message } from "botbuilder"
import "jest"
import { Address } from "../../src/address"
import { CommandEvent, ConversationUpdateEvent, InstallationUpdateEvent } from "../../src/events"
import { ISlackCommandEnvelope, ISlackEvent, ISlackMessageEvent } from "../../src/interfaces"
import { defaultInteractiveMessageEnvelope, defaultMessageEnvelope } from "./defaults"

export function expectedMessage(event: ISlackMessageEvent, mentions: IIdentity[] = []): IMessage {
  const address = new Address(defaultMessageEnvelope.team_id)
    .bot("BXXX", "test_bot")
    .user(event.user, "User X")
    .channel(event.channel)
    .id(event.event_ts)

  const entities = mentions.map((x) => {
    return {
      type: "mention",
      text: `<@${x.id}>`,
      mentioned: {
        id: `${x.id}:TXXX`,
        name: x.name,
      },
    }
  })

  return new Message()
    .address(address.toAddress())
    .text(event.text)
    .timestamp(event.ts)
    .sourceEvent({
      slack: {
        SlackMessage: {
          ...event,
          team: defaultMessageEnvelope.team_id,
          source_team: defaultMessageEnvelope.team_id,
        },
        ApiToken: "XXX",
      },
    })
    .entities(entities)
    .toMessage()
}

export function expectedCommandEvent(envelope: ISlackCommandEnvelope): IEvent {
  const address = new Address("TXXX")
    .bot("BXXX", "test_bot")
    .user(envelope.user_id)
    .channel(envelope.channel_id)

  return new CommandEvent()
    .address(address.toAddress())
    .sourceEvent({
      SlackMessage: {
        ...envelope,
      },
      ApiToken: "XXX",
    })
    .toEvent()
}

export function expectedConversationUpdateEvent(event: ISlackEvent, isBotTheUser: boolean): IEvent {
  const bot = {
    id: "BXXX:TXXX",
    name: "test_bot",
  }

  const user = isBotTheUser ? bot : {
    id: `${event.user}:${defaultMessageEnvelope.team_id}`,
    name: "User X",
  }

  const conversation = {
    id: `BXXX:TXXX:${event.channel.id || event.channel}`,
    isGroup: true,
  }

  const e = new ConversationUpdateEvent()
    .address({
      channelId: "slack",
      user,
      bot,
      conversation,
    })
    .sourceEvent({
      SlackMessage: {
        ...event,
      },
      ApiToken: "XXX",
    })
    .timestamp(event.event_ts)

  if (event.type === "member_joined_channel") {
    e.membersAdded([user])
  } else if (event.type === "member_left_channel") {
    e.membersRemoved([user])
  }

  return e.toEvent()
}

export function expectedInteractiveMessage(action: any): IMessage {
  const address = new Address(defaultInteractiveMessageEnvelope.team.id)
    .bot("BXXX", "test_bot")
    .user(defaultInteractiveMessageEnvelope.user.id)
    .channel(defaultInteractiveMessageEnvelope.channel.id)
    .id(defaultInteractiveMessageEnvelope.message_ts)

  return new Message()
    .text(action.value)
    .address(address.toAddress())
    .timestamp(defaultInteractiveMessageEnvelope.action_ts)
    .sourceEvent({
      slack: {
        Payload: {
          ...defaultInteractiveMessageEnvelope,
          actions: [action],
        },
        ApiToken: "XXX",
      },
    })
    .toMessage()
}

export function expectedInstallationUpdateAddEvent(event: any): IEvent {
  const address = new Address("TXXX")
    .bot("BXXX", "test_bot")
    .user(event.user_id)

  return new InstallationUpdateEvent()
    .address(address.toAddress())
    .action("add")
    .sourceEvent({
      SlackMessage: {
        ...event,
      },
      ApiToken: event.bot.bot_access_token,
    })
    .toEvent()
}

export function expectedInstallationUpdateRemoveEvent(event: any): IEvent {
  const address = new Address("TXXX")
    .bot("BXXX", "test_bot")
    .user("BXXX", "test_bot")

  return new InstallationUpdateEvent()
    .address(address.toAddress())
    .action("remove")
    .sourceEvent({
      SlackMessage: {
        ...event,
      },
      ApiToken: "XXX",
    })
    .toEvent()
}
