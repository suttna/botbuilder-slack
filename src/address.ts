import { IAddress, IIdentity } from "botbuilder"
import { ISlackAddress } from "./slack_connector"

export interface IIsAddress {
  toAddress(): IAddress
}

export class Address {
  private data = {} as ISlackAddress

  private teamId: string
  private channelId?: string

  constructor(teamId: string) {
    this.teamId = teamId

    this.data.channelId = "slack"
  }

  public id(id: string) {
    this.data.id = id

    return this
  }

  public channel(channel: string) {
    this.channelId = channel

    return this
  }

  public user(user: string, name?: string) {
    this.data.user = buildIdentity(user, this.teamId, name)

    return this
  }

  public bot(bot: string, name?: string) {
    this.data.bot = buildIdentity(bot, this.teamId, name)

    return this
  }

  public toAddress() {
    if (!this.data.bot || !this.data.user) {
      throw new Error("Invalid address")
    }

    if (this.channelId) {
      this.data.conversation = buildConversationIdentity(this.channelId, this.data.bot.id)
    }

    return this.data
  }
}

export function buildIdentity(userId: string, teamId: string, name?: string): IIdentity {
  const identity: IIdentity = {
    id: `${userId}:${teamId}`,
  }

  if (name) {
    identity.name = name
  }

  return identity
}

export function buildConversationIdentity(slackChannelId: string, botId: string): IIdentity {
  return {
    id: `${botId}:${slackChannelId}`,
    isGroup: isGroupConversation(slackChannelId),
  }
}

export function isGroupConversation(slackChannelId: string): boolean {
  const channelType = slackChannelId[0]

  return channelType === "C" || channelType === "G"
}
