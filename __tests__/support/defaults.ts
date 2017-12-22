import { IAddress } from "botbuilder"

export const defaultTeam    = "TXXX"
export const defaultBot     = "BXXX"
export const defaultBotUser = "UBXX"
export const defaulChannel  = "CXXX"
export const defaultUser    = "UXXX"

export const defaultDataCache = {
  findUsers: (userIds: string[]) => {
    return Promise.resolve([
      { id: "UXXX:TXXX", name: "User X" },
      { id: "UZZZ:TXXX", name: "User Z" },
    ].filter((x) => userIds.includes(x.id)))
  },
}

export const defaultAddress: IAddress = {
  channelId: "slack",
  bot: { id: "BXXX:TXXX" },
  user: { id: "UXXX:TXXX" },
  conversation: { id: "BXXX:TXXX:CXXX" },
}

export const defaultMessageEnvelope = {
  token: "ZZZ",
  team_id: "TXXX",
  api_app_id: "A60LNSDMF",
  type: "event_callback",
  authed_users: [ "U61947K6Y" ],
  event_id: "Ev71RC55GS",
  event_time: 1505227601,
}

export const defaultInteractiveMessageEnvelope = {
  callback_id: "botbuilder",
  team: {
    id: "TXXX",
    domain: "test",
  },
  channel: {
     id: "CXXX",
     name: "Test Channel",
  },
  user: {
    id: "UXXX",
    name: "user",
  },
  action_ts: "1505323255.970063",
  message_ts: "1505323235.000403",
  attachment_id: "2",
  token: "ZZZ",
  is_app_unfurl: "false",
  original_message: { something: "here" },
}

export const defaultCommandEnvelope = {
  token: "ZZZ",
  team_id: "TXXX",
  team_domain: "suttna.com",
  enterprise_id: "EXXX",
  enterprise_name: "Suttna Inc",
  channel_id: "CXXX",
  channel_name: "test",
  user_id: "UXXX",
  user_name: "Test",
  command: "/checkin",
  text: "#channel",
  response_url: "https://hooks.slack.com/commands/1234/5678",
}
