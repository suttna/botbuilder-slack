import { IEvent } from "botbuilder"
import { Event } from "./event"

export interface IInstallationUpdate extends IEvent {
  action: string
}

export class InstallationUpdateEvent extends Event {

  constructor() {
    super()

    this.data.type = "installationUpdate"
  }

  public action(action: string) {
    (this.data as IInstallationUpdate).action = action

    return this
  }
}
