import { IConversationUpdate, IIdentity } from "botbuilder"
import { Event } from "./event"

export class ConversationUpdateEvent extends Event {

  constructor() {
    super()

    this.data.type = "conversationUpdate"
  }

  public membersAdded(membersAdded: IIdentity[]) {
    (this.data as IConversationUpdate).membersAdded = membersAdded

    return this
  }

  public membersRemoved(membersRemoved: IIdentity[]) {
    (this.data as IConversationUpdate).membersRemoved = membersRemoved

    return this
  }
}
