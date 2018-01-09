export type EventEnvelopeType = "url_verification" | "event_callback"

export type Nullable<T> = { [P in keyof T]: T[P] | null }

export interface IMention {
  type: "mention"
  mentioned: {
    id: string
    name?: string,
  }
  text: string
}

export interface ISlackDataCache {
  findUsers: (userIds: string[]) => Promise<ISlackUser[]>
}

export interface ISlackUser {
  id: string
  name: string
}

export interface ISlackEnvelope {
  token: string
}

export interface ISlackOAuthEnvelope {
  error?: string
  code?: string
}

export interface ISlackConversationIdentifier {
  botId: string
  channelId: string
  teamId: string
  messageId?: string
}

export interface ISlackBotIdentifier {
  botId: string
  teamId: string
}

export interface ISlackUserIdentifier {
  userId: string
  teamId: string
}

export interface ISlackEventEnvelope extends ISlackEnvelope {
  team_id?: string
  api_app_id?: string
  event?: ISlackEvent
  type: string
  authed_users?: string[]
  event_id?: string
  event_time?: number
  challenge?: string
}

export interface ISlackCommandEnvelope extends ISlackEnvelope {
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

export interface ISlackEvent {
  type: string
  event_ts?: string
  user?: string
  channel?: string | any
  thread_ts?: string
}

export interface ISlackMessageEvent extends ISlackEvent {
  type: "message",
  text: string
  ts: string
  bot_id?: string,
  subtype?: "bot_message"
}

export interface ISlackMemberJoinedChannelEvent extends ISlackEvent {
  type: "member_joined_channel",
  user: string
  channel: string
  channel_type: string
  inviter: string
}

export interface ISlackAppUninstalledEvent extends ISlackEvent {
  type: "app_uninstalled"
}

export interface ISlackMemberLeftChannelEvent extends ISlackEvent {
  type: "member_left_channel",
  user: string
  channel: string
  channel_type: string
  inviter: string
}

export interface ISlackMessageAction {
  type: string
  text: string
  value: string
}

export interface ISlackInteractiveMessageEnvelope extends ISlackEnvelope {
  actions: ISlackMessageAction[]
  callback_id: "botbuilder"
  action_ts: string
  message_ts: string
  attachment_id: string
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
