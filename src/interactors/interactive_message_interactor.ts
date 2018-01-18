import { Message } from "botbuilder"
import { Address } from "../address"
import { UnauthorizedError } from "../errors"
import { ISlackInteractiveMessageEnvelope } from "../interfaces"
import * as utils from "../utils"
import { BaseInteractor, IInteractorResult } from "./base_interactor"

export class InteractiveMessageInteractor extends BaseInteractor<ISlackInteractiveMessageEnvelope> {
  public async call(): Promise<IInteractorResult> {
    if (!utils.isValidEnvelope(this.envelope, this.settings.verificationToken)) {
      throw new UnauthorizedError()
    }

    const [token, botIdentifier] = await this.settings.botLookup(this.envelope.team.id)

    const botIdentity = utils.decomposeUserId(botIdentifier)
    const userIdentity = await this.buildUser(botIdentifier, this.envelope.user.id)

    const address = new Address(botIdentity.teamId)
      .user(this.envelope.user.id, userIdentity.name)
      .channel(this.envelope.channel.id)
      .bot(botIdentity.userId, this.settings.botName)
      .thread(this.envelope.original_message.thread_ts)
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
