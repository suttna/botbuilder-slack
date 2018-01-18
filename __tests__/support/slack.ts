import { IMessage } from "botbuilder"
import { ISlackAddress } from "../../src/slack_connector"
import * as utils from "../../src/utils"

export function convertBotbuilderMessageToSlackPostData(message: IMessage): any {
  const postData = utils.buildSlackMessage(message) as any

  if (postData.attachments) {
    postData.attachments = JSON.stringify(postData.attachments)
  }

  postData.token = "XXX"

  return postData
}

export function convertBotbuilderMessageToSlackUpdateData(message: IMessage): any {
  const postData = convertBotbuilderMessageToSlackPostData(message)

  if ((message.address as ISlackAddress).id) {
    postData.ts = (message.address as ISlackAddress).id
  }

  return postData
}
