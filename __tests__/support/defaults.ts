import { IAddress } from "botbuilder"

export const defaultTeam = "TXXX"
export const defaultBot = "BXXX"
export const defaulChannel = "CXXX"

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
