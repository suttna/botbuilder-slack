import { AuthAccessResult, WebClient } from "@slack/client"
import { IEvent } from "botbuilder"

import { OAuthAccessDeniedError } from "../errors"
import { ISlackConnectorSettings } from "../slack_connector"
import * as utils from "../utils"
import { IInteractorResult } from "./"

export interface IOAuthOptions {
  error?: string
  code?: string
}

export class OAuthInteractor {

  constructor(private settings: ISlackConnectorSettings, private options: IOAuthOptions) { }

  public async call(): Promise<IInteractorResult> {
    if (this.options.error === "access_denied") {
      throw new OAuthAccessDeniedError()
    }

    const client = new WebClient()

    const result = await client.oauth.access(
      this.settings.clientId,
      this.settings.clientSecret,
      this.options.code,
      { redirect_uri: this.settings.redirectUrl },
    )

    const event = await this.buildInstallationUpdateEvent(result)

    return { events: [event] }
  }

  private async buildInstallationUpdateEvent(accessResult: AuthAccessResult): Promise<IEvent> {
    const bot = await (new WebClient(accessResult.access_token).users.info(accessResult.bot.bot_user_id))
    const user = utils.buildUserIdentity(accessResult.user_id, accessResult.team_id)

    const address = {
      channelId: "slack",
      user,
      bot: utils.buildBotIdentity(
        utils.buildUserIdentity(bot.user.profile.bot_id, accessResult.team_id).id,
        bot.user.name,
      ),
    }

    // Remove the ok key
    delete accessResult.ok

    return {
      type: "installationUpdate",
      source: "slack",
      agent: "botbuilder",
      sourceEvent: {
        SlackMessage: {
          ...accessResult,
        },
        ApiToken: accessResult.bot.bot_access_token,
      },
      address,
      user,
    }
  }
}
