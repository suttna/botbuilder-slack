import { IEvent } from "botbuilder"

export interface IInteractorResult {
  events: IEvent[]
  response?: any
}

export { EventInteractor } from "./event_interactor"
export { InteractiveMessageInteractor } from "./interactive_message_interactor"
export { OAuthInteractor } from "./oauth_interactor"
export { CommandInteractor } from "./command_interactor"
