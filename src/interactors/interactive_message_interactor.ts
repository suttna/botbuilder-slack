import { IMessage, Message } from "botbuilder"
import { UnauthorizedError } from "../errors"
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

    const address = utils.buildAddress(
      this.envelope.team.id,
      this.envelope.user.id,
      this.envelope.channel.id,
      botIdentifier,
      this.settings.botName,
      this.envelope.message_ts,
    )

    const sourceEvent = this.buildInteractiveMessageSourceEvent(token)

    const message = new Message()
      .address(address)
      .timestamp(this.envelope.action_ts)
      .sourceEvent(sourceEvent)
      .text(this.envelope.actions[0].value)

    return {
      events: [
        {
          ...message.toMessage(),
          user: address.user,
        } as IMessage,
      ],
    }
  }

  public buildInteractiveMessageSourceEvent(token: string) {
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
