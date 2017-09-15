import { IMessage } from "botbuilder"
import "jest"
import { ISlackAddress } from "../../src/slack_connector"
import { defaultInteractiveMessageEnvelope, defaultMessageEnvelope } from "./defaults"

export function expectedMessage(event: ISlackMessageEvent, mentions: string[] = []): IMessage {
  const user = { id: `${event.user}:${defaultMessageEnvelope.team_id}` }
  const bot = { id: "BXXX:TXXX", name: "test_bot" }
  const conversation = { id: `BXXX:TXXX:${event.channel}`, isGroup: true }

  const entities = mentions.map((x) => {
    return {
      type: "mention",
      text: `<@${x}>`,
      mentioned: {
        id: `${x}:TXXX`,
      },
    }
  })

  return {
    type: "message",
    agent: "botbuilder",
    source: "slack",
    timestamp: event.ts,
    entities,
    user,
    sourceEvent: {
      SlackMessage: {
        ...event,
        team: defaultMessageEnvelope.team_id,
        source_team: defaultMessageEnvelope.team_id,
      },
      ApiToken: "XXX",
    },
    text: event.text,
    address: {
      id: event.ts,
      channelId: "slack",
      user,
      bot,
      conversation,
    } as ISlackAddress,
  }
}

export function expectedEvent(event: ISlackEvent, isBotTheUser: boolean): IMessage {
  const bot = {
    id: "BXXX:TXXX",
    name: "test_bot",
  }

  const user = isBotTheUser ? bot : {
    id: `${event.user}:${defaultMessageEnvelope.team_id}`,
  }

  const conversation = {
    id: `BXXX:TXXX:${event.channel}`,
    isGroup: true,
  }

  let extraAttributes = {}

  if (event.type === "member_joined_channel") {
    extraAttributes = { membersAdded: [ user ] }
  } else if (event.type === "member_left_channel") {
    extraAttributes = { membersRemoved: [ user ] }
  }

  return {
    type: "conversationUpdate",
    source: "slack",
    agent: "botbuilder",
    attachments: [],
    entities: [],
    timestamp: event.event_ts,
    user,
    sourceEvent: {
      SlackMessage: {
        ...event,
      },
      ApiToken: "XXX",
    },
    text: "",
    address: {
      channelId: "slack",
      user,
      bot,
      conversation,
    } as ISlackAddress,
    ...extraAttributes,
  }
}

export function expectedInteractiveMessage(action: any): IMessage {
  const user = {
    id: `${defaultInteractiveMessageEnvelope.user.id}:${defaultInteractiveMessageEnvelope.team.id}`,
  }

  const bot = {
    id: "BXXX:TXXX",
    name: "test_bot",
  }

  const conversation = {
    id: `BXXX:TXXX:${defaultInteractiveMessageEnvelope.channel.id}`,
    isGroup: true,
  }

  return {
    type: "message",
    agent: "botbuilder",
    source: "slack",
    timestamp: defaultInteractiveMessageEnvelope.action_ts,
    user,
    sourceEvent: {
      Payload: {
        ...defaultInteractiveMessageEnvelope,
        actions: [action],
      },
      ApiToken: "XXX",
    },
    text: action.value,
    address: {
      id: defaultInteractiveMessageEnvelope.message_ts,
      channelId: "slack",
      user,
      bot,
      conversation,
    } as ISlackAddress,
  }
}
