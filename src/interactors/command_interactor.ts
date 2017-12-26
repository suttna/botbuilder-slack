import { IEvent } from "botbuilder"
import { Address } from "../address"
import { UnauthorizedError } from "../errors"
import { CommandEvent } from "../events"
import { ISlackCommandEnvelope } from "../interfaces"
import { ISlackConnectorSettings } from "../slack_connector"
import * as utils from "../utils"
import { IInteractorResult } from "./"

export class CommandInteractor {

  constructor(private settings: ISlackConnectorSettings, private envelope: ISlackCommandEnvelope) { }

  public async call(): Promise<IInteractorResult> {
    if (!utils.isValidEnvelope(this.envelope, this.settings.verificationToken)) {
      throw new UnauthorizedError()
    }

    const [token, botIdentifier] = await this.settings.botLookup(this.envelope.team_id)
    const event = this.buildCommandEvent(token, botIdentifier)

    return { events: [event] }
  }

  private buildCommandEvent(token: string, botIdentifier: string): IEvent {
    const botIdentity = utils.decomposeUserId(botIdentifier)
    const address = new Address(botIdentity.team)
      .user(this.envelope.user_id)
      .bot(botIdentity.user, this.settings.botName)
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
