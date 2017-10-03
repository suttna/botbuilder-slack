import { ChatPostMessageParams, MessageAttachment } from "@slack/client"
import { IIdentity, IMessage } from "botbuilder"

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

export function extractMentions(text: string, teamId: string, botId: string, botUserId: string): IMention[] {
  const matches = text.match(/<@(\w+)>/g)

  // Skip if no matches
  if (!matches) { return [] }

  return matches.map((x) => {
    const userId = x.replace("<@", "").replace(">", "")

    const buildMentionId = (id: string) => {
      if (id === botUserId) {
        return botId
      } else {
        return `${id}:${teamId}`
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
