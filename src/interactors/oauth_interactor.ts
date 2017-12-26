import { AuthAccessResult, WebClient } from "@slack/client"
import { IEvent } from "botbuilder"
import { Address } from "../address"
import { OAuthAccessDeniedError } from "../errors"
import { InstallationUpdateEvent } from "../events/installation_update"
import { ISlackOAuthEnvelope } from "../interfaces"
import { BaseInteractor, IInteractorResult } from "./base_interactor"

export class OAuthInteractor extends BaseInteractor<ISlackOAuthEnvelope> {

  public async call(): Promise<IInteractorResult> {
    if (this.envelope.error === "access_denied") {
      throw new OAuthAccessDeniedError()
    }

    const client = new WebClient()

    const result = await client.oauth.access(
      this.settings.clientId,
      this.settings.clientSecret,
      this.envelope.code,
      { redirect_uri: this.settings.redirectUrl },
    )

    const event = await this.buildInstallationUpdateEvent(result)

    return { events: [event] }
  }

  private async buildInstallationUpdateEvent(accessResult: AuthAccessResult): Promise<IEvent> {
    const botUser = await (new WebClient(accessResult.access_token).users.info(accessResult.bot.bot_user_id))

    const address = new Address(accessResult.team_id)
      .bot(botUser.user.profile.bot_id, botUser.user.name)
      .user(accessResult.user_id)

    // Remove the ok key
    delete accessResult.ok

    return new InstallationUpdateEvent()
      .action("add")
      .address(address.toAddress())
      .sourceEvent({
        SlackMessage: {
          ...accessResult,
        },
        ApiToken: accessResult.bot.bot_access_token,
      })
      .toEvent()
  }
}
