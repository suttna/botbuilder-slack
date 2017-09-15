import "jest"

import { CardAction, HeroCard, IEvent, IMessage, Message } from "botbuilder"
import * as nock from "nock"

import { defaultAddress } from "./support/defaults"
import {
  dispatchEvent,
  dispatchEventEnvelop,
  dispatchInteractiveMessageAction,
  dispatchInteractiveMessageEnvelope,
} from "./support/dispatch"
import { expectedEvent, expectedInteractiveMessage, expectedMessage } from "./support/expect"

import { SlackConnector } from "../src/slack_connector"

// Useful for debugging slack api calls
//
// nock.disableNetConnect()
// nock.recorder.rec()

describe("SlackConnector", () => {
  let connector: SlackConnector
  let onDispatchEvents: (events: IEvent[], cb?: (err: Error) => void) => void

  let onDispatchMock: jest.Mock<void>
  let endMock: jest.Mock<void>

  beforeEach(() => {
    jest.resetAllMocks()
    nock.cleanAll()

    connector = new SlackConnector({
      botLookup: (id: string) => Promise.resolve(["XXX", "BXXX:TXXX"] as [string, string]),
      botName: "test_bot",
      verificationToken: "ZZZ",
    })

    onDispatchMock = jest.fn<any>()
    endMock = jest.fn()

    onDispatchEvents = onDispatchMock

    connector.onEvent(onDispatchEvents)
  })

  describe("send", () => {
    let msg: IMessage

    describe("when sending a text only message", () => {
      beforeEach(() => {
        msg = new Message().address(defaultAddress).text("Testing...").toMessage()
      })

      it("invokes the slack api", (done) => {
        const stub = nock("https://slack.com")
          .post("/api/chat.postMessage", "channel=CXXX&attachments=%5B%7B%22fallback%22%3A%22Testing...%22%2C%22pretext%22%3A%22Testing...%22%2C%22mrkdwn_in%22%3A%5B%22pretext%22%5D%7D%5D&text=&token=XXX") // tslint:disable-line
          .reply(200, {
            ok: true,
            ts: "1405895017.000506",
            channel: "CXXX",
          })

        connector.send([msg], (err, addresses) => {
          expect(addresses[0]).toMatchObject({
            id: "1405895017.000506",
            ...defaultAddress,
          })

          expect(stub.isDone()).toBeTruthy()
          done()
        })
      })
    })

    describe("when sending a message with attachments", () => {
      beforeEach(() => {
        const hero = new HeroCard()

        hero
          .title("Title!")
          .subtitle("Subtitle!")
          .buttons([
            new CardAction().type("postBack").value("action?data=button1").title("Button 1"),
            new CardAction().type("postBack").value("action?data=button2").title("Button 2"),
          ])

        msg = new Message()
          .address(defaultAddress)
          .addAttachment(hero)
          .text("This is another possible text")
          .toMessage()
      })

      it("invokes the slack api", (done) => {
        const stub = nock("https://slack.com")
          .post("/api/chat.postMessage", "channel=CXXX&attachments=%5B%7B%22fallback%22%3A%22This%20is%20another%20possible%20text%22%2C%22pretext%22%3A%22This%20is%20another%20possible%20text%22%2C%22mrkdwn_in%22%3A%5B%22pretext%22%5D%7D%2C%7B%22callback_id%22%3A%22botbuilder%22%2C%22fallback%22%3A%22This%20is%20another%20possible%20text%22%2C%22pretext%22%3A%22Title%21%22%2C%22title%22%3A%22Subtitle%21%22%2C%22mrkdwn_in%22%3A%5B%22text%22%2C%22pretext%22%5D%2C%22actions%22%3A%5B%7B%22type%22%3A%22button%22%2C%22name%22%3A%22Button%201%22%2C%22text%22%3A%22Button%201%22%2C%22value%22%3A%22action%3Fdata%3Dbutton1%22%7D%2C%7B%22type%22%3A%22button%22%2C%22name%22%3A%22Button%202%22%2C%22text%22%3A%22Button%202%22%2C%22value%22%3A%22action%3Fdata%3Dbutton2%22%7D%5D%7D%5D&text=&token=XXX") // tslint:disable-line
          .reply(200, {
            ok: true,
            ts: "1405895017.000506",
            channel: "CXXX",
          })

        connector.send([msg], (err, addresses) => {
          expect(addresses[0]).toMatchObject({
            id: "1405895017.000506",
            ...defaultAddress,
          })

          expect(stub.isDone()).toBeTruthy()
          done()
        })
      })
    })

    describe("when sending a endOfConversation message type", () => {
      beforeEach(() => {
        msg = { type: "endOfConversation", address: defaultAddress } as IMessage
      })

      it("doesn't invoke the slack api", (done) => {
        const stub = nock("https://slack.com")
          .post("/api/chat.postMessage")
          .reply(200)

        connector.send([msg], (err, addresses) => {
          expect(addresses[0]).toMatchObject(defaultAddress)
          expect(stub.isDone()).toBeFalsy()
          done()
        })
      })
    })
  })

  describe("listenInteractiveMessages", () => {
    describe("when token is wrong", () => {
      it("responds with status code 400", (done) => {
        const envelope = {
          payload: {
            token: "bad",
          },
        }

        dispatchInteractiveMessageEnvelope(connector, envelope as any, endMock, () => {
          expect(endMock).toHaveBeenCalledWith(400)
          done()
        })
      })
    })

    it("dispatch a message event", (done) => {
      const action = {
        name: "Questions",
        type: "button",
        text: "Questions",
        value: "action?prompt-menu=questions",
      }

      dispatchInteractiveMessageAction(connector, action, endMock, () => {
        expect(onDispatchMock).toHaveBeenCalledTimes(1)
        expect(onDispatchMock).toHaveBeenCalledWith([
          expectedInteractiveMessage(action),
        ])
        expect(endMock).toHaveBeenCalledTimes(1)
        done()
      })
    })
  })

  describe("listenEvents", () => {
    describe("when token is wrong", () => {
      it("responds with status code 400", (done) => {
        const event = {
          token: "bad",
        }

        dispatchEventEnvelop(connector, event as ISlackEventEnvelope, endMock, () => {
          expect(endMock).toHaveBeenCalledWith(400)
          done()
        })
      })
    })

    describe("when a url_verification is sent", () => {
      it("responds with the challenge", (done) => {
        const event = {
          token: "ZZZ",
          challenge: "CCCC",
          type: "url_verification",
        }

        dispatchEventEnvelop(connector, event, endMock, () => {
          expect(endMock).toHaveBeenCalledWith("CCCC")
          done()
        })
      })
    })

    describe("when a event is received", () => {
      const baseEvent = {
        user: "UXXX",
        channel: "CXXX",
        channel_type: "C",
        event_ts: "1505227601.000491",
      }

      describe("when the event type is member_joined_channel", () => {
        it("dispatch a conversationUpdate event", (done) => {
          const event = {
            type: "member_joined_channel",
            inviter: "UZZZ",
            ...baseEvent,
          }

          dispatchEvent(connector, event, endMock, () => {
            expect(onDispatchMock).toHaveBeenCalledTimes(1)
            expect(onDispatchMock).toHaveBeenCalledWith([
              expectedEvent(event, false),
            ])
            expect(endMock).toHaveBeenCalledTimes(1)
            done()
          })
        })
      })

      describe("when the event type is member_left_channel", () => {
        it("dispatch a conversationUpdate event", (done) => {
          const event = {
            type: "member_left_channel",
            inviter: "UZZZ",
            ...baseEvent,
          }

          dispatchEvent(connector, event, endMock, () => {
            expect(onDispatchMock).toHaveBeenCalledTimes(1)
            expect(onDispatchMock).toHaveBeenCalledWith([
              expectedEvent(event, false),
            ])
            expect(endMock).toHaveBeenCalledTimes(1)
            done()
          })
        })
      })

      describe("when the event type is channel_archive", () => {
        it("dispatch a conversationUpdate event", (done) => {
          const event = {
            type: "channel_archive",
            ...baseEvent,
          }

          dispatchEvent(connector, event, endMock, () => {
            expect(onDispatchMock).toHaveBeenCalledTimes(1)
            expect(onDispatchMock).toHaveBeenCalledWith([
              expectedEvent(event, true),
            ])
            expect(endMock).toHaveBeenCalledTimes(1)
            done()
          })
        })
      })

      describe("when the event type is channel_created", () => {
        it("dispatch a conversationUpdate event", (done) => {
          const event = {
            type: "channel_created",
            ...baseEvent,
          }

          dispatchEvent(connector, event, endMock, () => {
            expect(onDispatchMock).toHaveBeenCalledTimes(1)
            expect(onDispatchMock).toHaveBeenCalledWith([
              expectedEvent(event, true),
            ])
            expect(endMock).toHaveBeenCalledTimes(1)
            done()
          })
        })
      })

      describe("when the event type is channel_deleted", () => {
        it("dispatch a conversationUpdate event", (done) => {
          const event = {
            type: "channel_deleted",
            ...baseEvent,
          }

          dispatchEvent(connector, event, endMock, () => {
            expect(onDispatchMock).toHaveBeenCalledTimes(1)
            expect(onDispatchMock).toHaveBeenCalledWith([
              expectedEvent(event, true),
            ])
            expect(endMock).toHaveBeenCalledTimes(1)
            done()
          })
        })
      })

      describe("when the event type is channel_unarchive", () => {
        it("dispatch a conversationUpdate event", (done) => {
          const event = {
            type: "channel_unarchive",
            ...baseEvent,
          }

          dispatchEvent(connector, event, endMock, () => {
            expect(onDispatchMock).toHaveBeenCalledTimes(1)
            expect(onDispatchMock).toHaveBeenCalledWith([
              expectedEvent(event, true),
            ])
            expect(endMock).toHaveBeenCalledTimes(1)
            done()
          })
        })
      })

      describe("when the event type is group_archive", () => {
        it("dispatch a conversationUpdate event", (done) => {
          const event = {
            type: "group_archive",
            ...baseEvent,
          }

          dispatchEvent(connector, event, endMock, () => {
            expect(onDispatchMock).toHaveBeenCalledTimes(1)
            expect(onDispatchMock).toHaveBeenCalledWith([
              expectedEvent(event, true),
            ])
            expect(endMock).toHaveBeenCalledTimes(1)
            done()
          })
        })
      })

      describe("when the event type is group_rename", () => {
        it("dispatch a conversationUpdate event", (done) => {
          const event = {
            type: "group_rename",
            ...baseEvent,
          }

          dispatchEvent(connector, event, endMock, () => {
            expect(onDispatchMock).toHaveBeenCalledTimes(1)
            expect(onDispatchMock).toHaveBeenCalledWith([
              expectedEvent(event, true),
            ])
            expect(endMock).toHaveBeenCalledTimes(1)
            done()
          })
        })
      })

      describe("when the event type is group_unarchive", () => {
        it("dispatch a conversationUpdate event", (done) => {
          const event = {
            type: "group_unarchive",
            ...baseEvent,
          }

          dispatchEvent(connector, event, endMock, () => {
            expect(onDispatchMock).toHaveBeenCalledTimes(1)
            expect(onDispatchMock).toHaveBeenCalledWith([
              expectedEvent(event, true),
            ])
            expect(endMock).toHaveBeenCalledTimes(1)
            done()
          })
        })
      })
    })

    describe("when a message is received from a bot", () => {
      it("doesn't dispatch an event", (done) => {
        const event = {
          type: "message",
          text: "",
          username: "Suttna Dev Bilby",
          bot_id: "BZZZ",
          subtype: "bot_message",
          ts: "1505227601.000491",
          channel: "CXXX",
          event_ts: "1505227601.000491",
        } as ISlackMessageEvent

        dispatchEvent(connector, event, endMock, () => {
          expect(onDispatchMock).toHaveBeenCalledTimes(0)
          expect(endMock).toHaveBeenCalledTimes(1)
          done()
        })
      })
    })

    describe("when a message is received from a user", () => {
      it("dispatch one message event", (done) => {
        const event = {
          text: "This is a test message",
          type: "message",
          user: "UXXX",
          ts: "1505227601.000491",
          channel: "CXXX",
          event_ts: "1505227601.000491",
        } as ISlackMessageEvent

        dispatchEvent(connector, event, endMock, () => {
          expect(onDispatchMock).toHaveBeenCalledTimes(1)
          expect(onDispatchMock).toHaveBeenCalledWith([
            expectedMessage(event),
          ])
          expect(endMock).toHaveBeenCalledTimes(1)
          done()
        })
      })

      describe("when the message contains mentions", () => {
        it("dispatch one message event with the mentions", (done) => {
          const event = {
            text: "This is a test message with a mention <@UZZZ>",
            type: "message",
            user: "UXXX",
            ts: "1505227601.000491",
            channel: "CXXX",
            event_ts: "1505227601.000491",
          } as ISlackMessageEvent

          dispatchEvent(connector, event, endMock, () => {
            expect(onDispatchMock).toHaveBeenCalledTimes(1)
            expect(onDispatchMock).toHaveBeenCalledWith([
              expectedMessage(event, ["UZZZ"]),
            ])
            expect(endMock).toHaveBeenCalledTimes(1)
            done()
          })
        })
      })

      describe("when the message contains attachments", () => {
        xit("adds the attachments to the message")
      })
    })
  })
})
