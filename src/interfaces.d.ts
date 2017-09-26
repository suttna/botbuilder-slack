type EventEnvelopeType = "url_verification" | "event_callback"

interface IMention {
  type: "mention"
  mentioned: {
    id: string
    name?: string,
  }
  text: string
}

interface ISlackConversationIdentifier {
  bot: string
  channel: string
  team: string
}

interface ISlackEventEnvelope {
  token: string
  team_id?: string
  api_app_id?: string
  event?: ISlackEvent
  type: string
  authed_users?: string[]
  event_id?: string
  event_time?: number
  challenge?: string
}

interface ISlackCommandEnvelope {
  token: string
  team_id: string
  team_domain: string
  enterprise_id: string
  enterprise_name: string
  channel_id: string
  channel_name: string
  user_id: string
  user_name: string
  command: string
  text: string
  response_url: string
}

interface ISlackEvent {
  type: string
  event_ts: string
  user?: string
  channel: string
}

interface ISlackMessageEvent extends ISlackEvent {
  type: "message",
  text: string
  ts: string
  bot_id?: string,
  subtype?: "bot_message"
}

interface ISlackMemberJoinedChannelEvent extends ISlackEvent {
  type: "member_joined_channel",
  user: string
  channel: string
  channel_type: string
  inviter: string
}

interface ISlackMemberLeftChannelEvent extends ISlackEvent {
  type: "member_left_channel",
  user: string
  channel: string
  channel_type: string
  inviter: string
}

interface ISlackMessageAction {
  type: string
  text: string
  value: string
}

interface ISlackInteractiveMessageEnvelope {
  actions: ISlackMessageAction[]
  callback_id: "botbuilder"
  action_ts: string
  message_ts: string
  attachment_id: string
  token: string
  is_app_unfurl: boolean
  original_message: any
  response_url: string
  trigger_id: string
  team: {
    id: string
    domain: string,
  }
  channel: {
    id: string
    name: string,
  }
  user: {
    id: string
    name: string,
  }
}
