import { ChatPostMessageParams, MessageAttachment } from "@slack/client"
import { IIdentity, IMessage } from "botbuilder"
import {
  IMention, ISlackConversationIdentifier, ISlackDataCache, ISlackEnvelop, ISlackUser, ISlackUserIdentifier,
} from "./interfaces"

export interface IMentionRequest {
  text: string
  teamId: string
  botId: string
  botUserId: string
  dataCache?: ISlackDataCache
}

export function isValidEnvelope(envelope: ISlackEnvelop, verificationToken: string): boolean {
  return envelope.token === verificationToken
}

export function decomposeConversationId(conversationId: string): ISlackConversationIdentifier {
  const [botId, teamId, slackConversationId] = conversationId.split(":")

  return {
    bot: botId,
    team: teamId,
    channel: slackConversationId,
  }
}

export function decomposeUserId(userId: string): ISlackUserIdentifier {
  const [user, team] = userId.split(":")

  return {
    user,
    team,
  }
}

export async function extractMentions(request: IMentionRequest): Promise<IMention[]> {
  const matches = request.text.match(/<@(\w+)>/g)

  // Skip if no matches
  if (!matches) { return [] }

  const mentions = matches.map((x) => {
    const userId = x.replace("<@", "").replace(">", "")

    const buildMentionId = (id: string) => {
      if (id === request.botUserId) {
        return request.botId
      } else {
        return `${id}:${request.teamId}`
      }
    }

    const mention: IMention = {
      type: "mention",
      text: x,
      mentioned: {
        id: buildMentionId(userId),
      },
    }

    return mention
  })

  // Return the parsed mentions if we don't have a cache for enrichment
  if (!request.dataCache) {
    return mentions
  }

  const users = await request.dataCache.findUsers(mentions.map((x) => x.mentioned.id))

  return mentions.map((m) => enrichMention(m, users))
}

function enrichMention(mention: IMention, users: ISlackUser[]): IMention {
  const cachedUser = users.find((c) => c.id === mention.mentioned.id)

  if (cachedUser) {
    mention.mentioned.name = cachedUser.name
  }

  return mention
}

export function buildSlackMessage(channel: string, message: IMessage): ChatPostMessageParams {
  let attachments: MessageAttachment[] = []

  if (message.text) {
    attachments.push(
      {
        fallback: message.text,
        pretext: message.text,
        mrkdwn_in: ["pretext"],
      },
    )
  }

  if (message.attachments) {
    attachments = attachments.concat(message.attachments.map((a) => {
      const content = a.content

      return {
        callback_id: "botbuilder",
        fallback: message.text  || "",
        pretext: content.title  || "",
        text: content.text || "",
        title: content.subtitle || "",
        mrkdwn_in: ["text", "pretext"],
        actions: content.buttons.map((x: any) => {
          return {
            type: "button",
            name: x.title,
            text: x.title,
            value: x.value,
          }
        }),
      }
    }))
  }

  return {
    channel,
    attachments,
  }
}

export function buildUserIdentity(slackUserId: string, teamId: string): IIdentity {
  return {
    id: `${slackUserId}:${teamId}`,
  }
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
