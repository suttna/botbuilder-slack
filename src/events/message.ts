import { Message  } from "botbuilder"

export class MessageEvent extends Message {

  public sourceEvent(sourceEvent: any) {
    this.data.sourceEvent = { slack: sourceEvent }

    return this
  }

}
