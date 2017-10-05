import "jest"
import * as qs from "qs"
import { IRequest, IResponse } from "../../src/http"
import { SlackConnector } from "../../src/slack_connector"
import { defaultInteractiveMessageEnvelope, defaultMessageEnvelope } from "./defaults"

/**
 * Dispatch the given event to the connector using the default envelope.
 */
export function dispatchEvent(
  connector: SlackConnector,
  event: ISlackEvent,
  endMock: jest.Mock<void>,
  next: () => void) {
  dispatchEventEnvelop(
    connector,
    { ...defaultMessageEnvelope, event },
    endMock,
    next,
  )
}

/**
 * Dispatch the given envelope to the connector.
 */
export function dispatchEventEnvelop(
  connector: SlackConnector,
  envelope: ISlackEventEnvelope,
  endMock: jest.Mock<void>,
  next: () => void) {
  const requestMock = jest.fn<IRequest>(() => ({
    body: envelope,
  }))

  const responseMock = jest.fn<IResponse>(() => ({
    end: endMock,
    status: jest.fn(),
    header: jest.fn(),
  }))

  connector.listenEvents()(new requestMock(), new responseMock(), next)
}

/**
 * Dispatch the given command envelope to the connector.
 */
export function dispatchCommandEnvelop(
  connector: SlackConnector,
  envelope: ISlackCommandEnvelope,
  endMock: jest.Mock<void>,
  next: () => void) {
  const requestMock = jest.fn<IRequest>(() => ({
    params: envelope,
  }))

  const responseMock = jest.fn<IResponse>(() => ({
    end: endMock,
    status: jest.fn(),
    header: jest.fn(),
  }))

  connector.listenCommands()(new requestMock(), new responseMock(), next)
}

/**
 * Dispatch the given interactive message action to the connector using the defaultInteractiveMessageEnvelope.
 */
export function dispatchInteractiveMessageAction(
  connector: SlackConnector,
  action: ISlackMessageAction,
  endMock: jest.Mock<void>,
  next: () => void) {
  const envelope = {
    ...defaultInteractiveMessageEnvelope,
    actions: [ action ],
  } as any

  dispatchInteractiveMessageEnvelope(
    connector,
    envelope,
    endMock,
    next,
  )
}

/**
 * Dispatch the given interactive message envelope to the connector.
 */
export function dispatchInteractiveMessageEnvelope(
  connector: SlackConnector,
  envelope: ISlackInteractiveMessageEnvelope,
  endMock: jest.Mock<void>,
  next: () => void) {
  const payload = { payload: JSON.stringify(envelope) }

  const requestMock = jest.fn<IRequest>(() => ({
    body: qs.stringify(payload),
  }))

  const responseMock = jest.fn<IResponse>(() => ({
    end: endMock,
    status: jest.fn(),
    header: jest.fn(),
  }))

  connector.listenInteractiveMessages()(new requestMock(), new responseMock(), next)
}
