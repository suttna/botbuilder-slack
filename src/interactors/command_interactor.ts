import { IEvent } from "botbuilder"
import { Address } from "../address"
import { UnauthorizedError } from "../errors"
import { CommandEvent } from "../events"
import { ISlackCommandEnvelope } from "../interfaces"
import * as utils from "../utils"
import { BaseInteractor, IInteractorResult } from "./base_interactor"

export class CommandInteractor extends BaseInteractor<ISlackCommandEnvelope> {
  public async call(): Promise<IInteractorResult> {
    if (!utils.isValidEnvelope(this.envelope, this.settings.verificationToken)) {
      throw new UnauthorizedError()
    }

    const [token, botIdentifier] = await this.settings.botLookup(this.envelope.team_id)
    const event = await this.buildCommandEvent(token, botIdentifier)

    return { events: [event] }
  }

  private async buildCommandEvent(token: string, botIdentifier: string): Promise<IEvent> {
    const botIdentity = utils.decomposeUserId(botIdentifier)
    const userIdentity = await this.buildUser(botIdentifier, this.envelope.user_id)

    const address = new Address(botIdentity.teamId)
      .user(this.envelope.user_id, userIdentity.name)
      .bot(botIdentity.userId, this.settings.botName)
      .channel(this.envelope.channel_id)

    return new CommandEvent()
      .address(address.toAddress())
      .sourceEvent({
        SlackMessage: {
          ...this.envelope,
        },
        ApiToken: token,
      })
      .toEvent()
  }
}
