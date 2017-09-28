import { IEvent } from "botbuilder"
import { UnauthorizedError } from "../errors"
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
    const address = utils.buildAddress(
      this.envelope.team_id,
      this.envelope.user_id,
      this.envelope.channel_id,
      botIdentifier,
      this.settings.botName,
    )

    return {
      type: "slackCommand",
      source: "slack",
      agent: "botbuilder",
      attachments: [],
      entities: [],
      sourceEvent: {
        SlackMessage: {
          ...this.envelope,
        },
        ApiToken: token,
      },
      address,
      user: address.user,
    } as IEvent
  }
}
