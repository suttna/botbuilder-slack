import { Message } from "botbuilder"
import { Address } from "../address"
import { UnauthorizedError } from "../errors"
import { ISlackInteractiveMessageEnvelope } from "../interfaces"
import { ISlackConnectorSettings } from "../slack_connector"
import * as utils from "../utils"
import { IInteractorResult } from "./"

export class InteractiveMessageInteractor {

  constructor(private settings: ISlackConnectorSettings, private envelope: ISlackInteractiveMessageEnvelope) { }

  public async call(): Promise<IInteractorResult> {
    if (!utils.isValidEnvelope(this.envelope, this.settings.verificationToken)) {
      throw new UnauthorizedError()
    }

    const [token, botIdentifier] = await this.settings.botLookup(this.envelope.team.id)

    const botIdentity = utils.decomposeUserId(botIdentifier)

    const address = new Address(botIdentity.team)
      .user(this.envelope.user.id)
      .channel(this.envelope.channel.id)
      .bot(botIdentity.user, this.settings.botName)
      .id(this.envelope.message_ts)

    const sourceEvent = this.buildInteractiveMessageSourceEvent(token)

    const message = new Message()
      .address(address.toAddress())
      .timestamp(this.envelope.action_ts)
      .sourceEvent(sourceEvent)
      .text(this.envelope.actions[0].value)
      .toMessage()

    return { events: [message] }
  }

  private buildInteractiveMessageSourceEvent(token: string) {
    return {
      slack: {
        Payload: {
          ...this.envelope,
        },
        ApiToken: token,
      },
    }
  }
}
