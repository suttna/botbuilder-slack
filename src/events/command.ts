import { Event } from "./event"

export class CommandEvent extends Event {

  constructor() {
    super()

    this.data.type = "slackCommand"
  }
}
