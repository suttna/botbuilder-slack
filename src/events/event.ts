import { IAddress, IEvent } from "botbuilder"

export interface IIsEvent {
  toEvent(): IEvent
}

export class Event {
  protected data = {} as IEvent

  constructor() {
    this.data.source = "slack"
    this.data.agent = "botbuilder"
  }

  public address(address: IAddress) {
    this.data.address = address
    this.data.user = address.user

    return this
  }

  public timestamp(timestamp: string) {
    (this.data as any).timestamp = timestamp

    return this
  }

  public sourceEvent(sourceEvent: any) {
    this.data.sourceEvent = sourceEvent

    return this
  }

  public toEvent() {
    return this.data
  }
}
