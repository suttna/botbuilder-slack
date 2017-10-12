import "jest"

import { CardAction, HeroCard, IEvent, IMessage, Message } from "botbuilder"
import * as nock from "nock"
import * as qs from "qs"
import { ConnectorTester } from "./support/connector_tester"
import { defaultAddress, defaultInteractiveMessageEnvelope, defaultMessageEnvelope } from "./support/defaults"

import {
  expectedCommandEvent,
  expectedConversationUpdateEvent,
  expectedInstallationUpdateEvent,
  expectedInteractiveMessage,
  expectedMessage,
} from "./support/expect"

import { ISlackAddress, SlackConnector } from "../src/slack_connector"

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
      clientId: "CID",
      clientSecret: "CSEC",
      redirectUrl: "https://test.com/oauth",
      onOAuthSuccessRedirectUrl: "https://test.com/success",
      onOAuthErrorRedirectUrl: "https://test.com/error",
      onOAuthAccessDeniedRedirectUrl: "https://test.com/denied",
    })

    onDispatchMock = jest.fn<any>()
    endMock = jest.fn()

    onDispatchEvents = onDispatchMock

    connector.onEvent(onDispatchEvents)
  })

  describe("startConversation", () => {
    it("invokes the slack api", (done) => {
      const stub = nock("https://slack.com")
        .post("/api/im.open", "user=UXXX&token=XXX")
        .reply(200, {
          ok: true,
          channel: {
            id: "DXXX",
          },
        })

      connector.startConversation(defaultAddress, (err, address) => {
        expect(address).toMatchObject({
          ...defaultAddress,
          conversation: { id: "BXXX:TXXX:DXXX" },
        })

        expect(stub.isDone()).toBeTruthy()
        done()
      })
    })
  })

  describe("send", () => {
    let msg: IMessage

    beforeEach(() => {
      // INFO: Botbuilder auto generates an id before creating the message in Slack.
      //   We need to be sure that we're updating that fake id and returning the new one from Slack.
      (defaultAddress as ISlackAddress).id = "1507762653.000073"
    })

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
          expect((addresses[0] as ISlackAddress).id).toBe("1405895017.000506")
          expect(addresses[0]).toMatchObject({
            ...defaultAddress,
            id: "1405895017.000506",
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
          .text("Text!")
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
          .post("/api/chat.postMessage", "channel=CXXX&attachments=%5B%7B%22fallback%22%3A%22This%20is%20another%20possible%20text%22%2C%22pretext%22%3A%22This%20is%20another%20possible%20text%22%2C%22mrkdwn_in%22%3A%5B%22pretext%22%5D%7D%2C%7B%22callback_id%22%3A%22botbuilder%22%2C%22fallback%22%3A%22This%20is%20another%20possible%20text%22%2C%22pretext%22%3A%22Title%21%22%2C%22text%22%3A%22Text%21%22%2C%22title%22%3A%22Subtitle%21%22%2C%22mrkdwn_in%22%3A%5B%22text%22%2C%22pretext%22%5D%2C%22actions%22%3A%5B%7B%22type%22%3A%22button%22%2C%22name%22%3A%22Button%201%22%2C%22text%22%3A%22Button%201%22%2C%22value%22%3A%22action%3Fdata%3Dbutton1%22%7D%2C%7B%22type%22%3A%22button%22%2C%22name%22%3A%22Button%202%22%2C%22text%22%3A%22Button%202%22%2C%22value%22%3A%22action%3Fdata%3Dbutton2%22%7D%5D%7D%5D&text=&token=XXX") // tslint:disable-line
          .reply(200, {
            ok: true,
            ts: "1405895017.000506",
            channel: "CXXX",
          })

        connector.send([msg], (err, addresses) => {
          expect((addresses[0] as ISlackAddress).id).toBe("1405895017.000506")
          expect(addresses[0]).toMatchObject({
            ...defaultAddress,
            id: "1405895017.000506",
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

  describe("update", () => {
    let msg: IMessage
    const address = { ...defaultAddress, id: "1111" } as ISlackAddress

    describe("when updating a text only message", () => {
      beforeEach(() => {

        msg = new Message().address(address).text("Testing...").toMessage()
      })

      it("invokes the slack api", (done) => {
        const stub = nock("https://slack.com")
          .post('/api/chat.update', "channel=CXXX&attachments=%5B%7B%22fallback%22%3A%22Testing...%22%2C%22pretext%22%3A%22Testing...%22%2C%22mrkdwn_in%22%3A%5B%22pretext%22%5D%7D%5D&ts=1111&text=&token=XXX") // tslint:disable-line
          .reply(200, {
            ok: true,
            ts: "1111",
            channel: "CXXX",
          })

        connector.update(msg, (err, anAddress) => {
          expect(anAddress).toMatchObject(address)

          expect(stub.isDone()).toBeTruthy()
          done()
        })
      })
    })

    describe("when updating a message with attachments", () => {
      beforeEach(() => {
        const hero = new HeroCard()

        hero
          .text("Text!")
          .title("Title!")
          .subtitle("Subtitle!")
          .buttons([
            new CardAction().type("postBack").value("action?data=button1").title("Button 1"),
            new CardAction().type("postBack").value("action?data=button2").title("Button 2"),
          ])

        msg = new Message()
          .address(address)
          .addAttachment(hero)
          .text("This is another possible text")
          .toMessage()
      })

      it("invokes the slack api", (done) => {
        const stub = nock("https://slack.com")
          .post("/api/chat.update", "channel=CXXX&attachments=%5B%7B%22fallback%22%3A%22This%20is%20another%20possible%20text%22%2C%22pretext%22%3A%22This%20is%20another%20possible%20text%22%2C%22mrkdwn_in%22%3A%5B%22pretext%22%5D%7D%2C%7B%22callback_id%22%3A%22botbuilder%22%2C%22fallback%22%3A%22This%20is%20another%20possible%20text%22%2C%22pretext%22%3A%22Title%21%22%2C%22text%22%3A%22Text%21%22%2C%22title%22%3A%22Subtitle%21%22%2C%22mrkdwn_in%22%3A%5B%22text%22%2C%22pretext%22%5D%2C%22actions%22%3A%5B%7B%22type%22%3A%22button%22%2C%22name%22%3A%22Button%201%22%2C%22text%22%3A%22Button%201%22%2C%22value%22%3A%22action%3Fdata%3Dbutton1%22%7D%2C%7B%22type%22%3A%22button%22%2C%22name%22%3A%22Button%202%22%2C%22text%22%3A%22Button%202%22%2C%22value%22%3A%22action%3Fdata%3Dbutton2%22%7D%5D%7D%5D&ts=1111&text=&token=XXX") // tslint:disable-line
          .reply(200, {
            ok: true,
            ts: "1111",
            channel: "CXXX",
          })

        connector.update(msg, (err, anAddress) => {
          expect(anAddress).toMatchObject(address)

          expect(stub.isDone()).toBeTruthy()
          done()
        })
      })
    })
  })

  describe("delete", () => {
    let msg: IMessage
    const address = { ...defaultAddress, id: "1111" } as ISlackAddress

    beforeEach(() => {
      msg = new Message().address(address).text("Testing...").toMessage()
    })

    it("invokes the slack api", (done) => {
      const stub = nock("https://slack.com")
        .post('/api/chat.delete', "ts=1111&channel=CXXX&token=XXX") // tslint:disable-line
        .reply(200, {
          ok: true,
          ts: "1111",
          channel: "CXXX",
        })

      connector.delete(msg.address, (err) => {
        expect(err).toBeNull()

        expect(stub.isDone()).toBeTruthy()
        done()
      })
    })
  })

  describe("listenOAuth", () => {
    describe("when user denies access", () => {
      it("redirects to onOAuthAccessDeniedRedirectUrl", () => {
        return new ConnectorTester(connector, connector.listenOAuth)
          .withQuery({ error: "access_denied" })
          .expectToRedirect("https://test.com/denied")
          .runTest()
      })
    })

    describe("when user grants access", () => {
      describe("when an api call fails", () => {
        it("redirects to onOAuthErrorRedirectUrl", () => {
          const accessStub = nock("https://slack.com")
            .post('/api/oauth.access', "redirect_uri=https%3A%2F%2Ftest.com%2Foauth&client_id=CID&client_secret=CSEC&code=CODE") // tslint:disable-line
            .reply(200, {
              ok: false,
            })

          return new ConnectorTester(connector, connector.listenOAuth)
            .withQuery({ code: "CODE" })
            .expectToRedirect("https://test.com/error")
            .then(() => expect(accessStub.isDone()).toBeTruthy())
            .runTest()
        })
      })

      describe("when everything is valid", () => {
        it("redirects to onOAuthSuccessRedirectUrl", () => {
          const partialAccessResult = {
            access_token: "xoxp-user",
            scope: "identify,bot",
            user_id: "UXXX",
            team_name: "Suttna",
            team_id: "TXXX",
            bot: {
              bot_user_id: "UBBB",
              bot_access_token: "xoxb-bot",
            },
            scopes: [] as string[],
            acceptedScopes: [] as string[],
          }

          const accessStub = nock("https://slack.com")
            .post('/api/oauth.access', "redirect_uri=https%3A%2F%2Ftest.com%2Foauth&client_id=CID&client_secret=CSEC&code=CODE") // tslint:disable-line
            .reply(200, {
              ok: true,
              ...partialAccessResult,
            })

          const botStub = nock("https://slack.com")
            .post("/api/users.info", "user=UBBB&token=xoxp-user")
            .reply(200, {
              ok: true,
              user: {
                name: "test_bot",
                profile: {
                  bot_id: "BXXX",
                },
              },
            })

          return new ConnectorTester(connector, connector.listenOAuth)
            .withQuery({ code: "CODE" })
            .expectToRedirect("https://test.com/success")
            .expectToDispatchEvent(expectedInstallationUpdateEvent(partialAccessResult))
            .then(() => expect(accessStub.isDone()).toBeTruthy())
            .then(() => expect(botStub.isDone()).toBeTruthy())
            .runTest()
        })
      })
    })
  })

  describe("listenCommands", () => {
    const envelope: ISlackCommandEnvelope = {
      token: "ZZZ",
      team_id: "TXXX",
      team_domain: "suttna.com",
      enterprise_id: "EXXX",
      enterprise_name: "Suttna Inc",
      channel_id: "CXXX",
      channel_name: "test",
      user_id: "UXXX",
      user_name: "Test",
      command: "/checkin",
      text: "#channel",
      response_url: "https://hooks.slack.com/commands/1234/5678",
    }

    describe("when token is wrong", () => {
      it("responds with status code 400", () => {
        return new ConnectorTester(connector, connector.listenCommands)
          .withBody({ ...envelope, token: "bad" })
          .expectToRespond(403)
          .runTest()
      })
    })

    describe("when token is valid", () => {
      it("dispatches the event", () => {
        return new ConnectorTester(connector, connector.listenCommands)
          .withBody(envelope)
          .expectToDispatchEvent(expectedCommandEvent(envelope))
          .expectToRespond(200)
          .runTest()
      })
    })
  })

  describe("listenInteractiveMessages", () => {
    const buildPayload = (envelope: ISlackInteractiveMessageEnvelope) => {
      const payload = { payload: JSON.stringify(envelope) }

      return qs.stringify(payload)
    }

    describe("when token is wrong", () => {
      it("responds with status code 400", () => {
        const envelope = {
          payload: {
            token: "bad",
          },
        }

        return new ConnectorTester(connector, connector.listenInteractiveMessages)
          .withBody(buildPayload(envelope as any))
          .expectToRespond(403)
          .runTest()
      })
    })

    it("dispatch a message event", () => {
      const action = {
        name: "Questions",
        type: "button",
        text: "Questions",
        value: "action?prompt-menu=questions",
      }

      const envelope = {
        ...defaultInteractiveMessageEnvelope,
        actions: [ action ],
      } as any

      return new ConnectorTester(connector, connector.listenInteractiveMessages)
        .withBody(buildPayload(envelope))
        .expectToRespond(200)
        .expectToDispatchEvent(expectedInteractiveMessage(action))
        .runTest()
    })
  })

  describe("listenEvents", () => {
    const buildEnvelope = (event: ISlackEvent) => {
      return { ...defaultMessageEnvelope, event }
    }

    describe("when token is wrong", () => {
      it("responds with status code 403", () => {
        const event = {
          token: "bad",
        }

        return new ConnectorTester(connector, connector.listenEvents)
          .withBody(event)
          .expectToRespond(403)
          .runTest()
      })
    })

    describe("when a url_verification is sent", () => {
      it("responds with the challenge", () => {
        const event = {
          token: "ZZZ",
          challenge: "CCCC",
          type: "url_verification",
        }

        return new ConnectorTester(connector, connector.listenEvents)
          .withBody(event)
          .expectToRespond(200, "CCCC")
          .runTest()
      })
    })

    describe("when a event is received", () => {
      const baseEvent = {
        user: "UXXX",
        channel: "CXXX",
        channel_type: "C",
        event_ts: "1505227601.000491",
      }

      describe("when the event type is app_uninstalled", () => {
        it("dispatch a installationUpdate event", () => {
          const event = {
            type: "app_uninstalled",
          }

          return new ConnectorTester(connector, connector.listenEvents)
            .withBody(buildEnvelope(event))
            .expectToRespond(200)
            .expectToDispatchEvent(expectedInstallationUpdateEvent(event))
            .runTest()
        })
      })

      describe("when the event type is member_joined_channel", () => {
        it("dispatch a conversationUpdate event", () => {
          const event = {
            type: "member_joined_channel",
            inviter: "UZZZ",
            ...baseEvent,
          }

          return new ConnectorTester(connector, connector.listenEvents)
            .withBody(buildEnvelope(event))
            .expectToRespond(200)
            .expectToDispatchEvent(expectedConversationUpdateEvent(event, false))
            .runTest()
        })
      })

      describe("when the event type is member_left_channel", () => {
        it("dispatch a conversationUpdate event", () => {
          const event = {
            type: "member_left_channel",
            inviter: "UZZZ",
            ...baseEvent,
          }

          return new ConnectorTester(connector, connector.listenEvents)
            .withBody(buildEnvelope(event))
            .expectToRespond(200)
            .expectToDispatchEvent(expectedConversationUpdateEvent(event, false))
            .runTest()
        })
      })

      describe("when the event type is group_rename", () => {
        it("dispatch a conversationUpdate event", () => {
          const event = {
            type: "channel_rename",
            channel: {
                id: "CXXX",
                name: "new_name",
                created: 1360782804,
            },
          }

          return new ConnectorTester(connector, connector.listenEvents)
            .withBody(buildEnvelope(event))
            .expectToRespond(200)
            .expectToDispatchEvent(expectedConversationUpdateEvent(event, true))
            .runTest()
        })
      })

      describe("when the event type is channel_archive", () => {
        it("dispatch a conversationUpdate event", () => {
          const event = {
            type: "channel_archive",
            ...baseEvent,
          }

          return new ConnectorTester(connector, connector.listenEvents)
            .withBody(buildEnvelope(event))
            .expectToRespond(200)
            .expectToDispatchEvent(expectedConversationUpdateEvent(event, true))
            .runTest()
        })
      })

      describe("when the event type is channel_created", () => {
        it("dispatch a conversationUpdate event", () => {
          const event = {
            type: "channel_created",
            ...baseEvent,
          }

          return new ConnectorTester(connector, connector.listenEvents)
            .withBody(buildEnvelope(event))
            .expectToRespond(200)
            .expectToDispatchEvent(expectedConversationUpdateEvent(event, true))
            .runTest()
        })
      })

      describe("when the event type is channel_deleted", () => {
        it("dispatch a conversationUpdate event", () => {
          const event = {
            type: "channel_deleted",
            ...baseEvent,
          }

          return new ConnectorTester(connector, connector.listenEvents)
            .withBody(buildEnvelope(event))
            .expectToRespond(200)
            .expectToDispatchEvent(expectedConversationUpdateEvent(event, true))
            .runTest()
        })
      })

      describe("when the event type is channel_unarchive", () => {
        it("dispatch a conversationUpdate event", () => {
          const event = {
            type: "channel_unarchive",
            ...baseEvent,
          }

          return new ConnectorTester(connector, connector.listenEvents)
            .withBody(buildEnvelope(event))
            .expectToRespond(200)
            .expectToDispatchEvent(expectedConversationUpdateEvent(event, true))
            .runTest()
        })
      })

      describe("when the event type is group_archive", () => {
        it("dispatch a conversationUpdate event", () => {
          const event = {
            type: "group_archive",
            ...baseEvent,
          }

          return new ConnectorTester(connector, connector.listenEvents)
            .withBody(buildEnvelope(event))
            .expectToRespond(200)
            .expectToDispatchEvent(expectedConversationUpdateEvent(event, true))
            .runTest()
        })
      })

      describe("when the event type is group_rename", () => {
        it("dispatch a conversationUpdate event", () => {
          const event = {
            type: "group_rename",
            channel: {
                id: "GXXX",
                name: "new_name",
                created: 1360782804,
            },
          }

          return new ConnectorTester(connector, connector.listenEvents)
            .withBody(buildEnvelope(event))
            .expectToRespond(200)
            .expectToDispatchEvent(expectedConversationUpdateEvent(event, true))
            .runTest()
        })
      })

      describe("when the event type is group_unarchive", () => {
        it("dispatch a conversationUpdate event", () => {
          const event = {
            type: "group_unarchive",
            ...baseEvent,
          }

          return new ConnectorTester(connector, connector.listenEvents)
            .withBody(buildEnvelope(event))
            .expectToRespond(200)
            .expectToDispatchEvent(expectedConversationUpdateEvent(event, true))
            .runTest()
        })
      })
    })

    describe("when a message is received from a bot", () => {
      it("doesn't dispatch an event", () => {
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

        return new ConnectorTester(connector, connector.listenEvents)
          .withBody(buildEnvelope(event))
          .expectToRespond(200)
          .expectNotToDispatchEvents()
          .runTest()
      })
    })

    describe("when a message is received from a user", () => {
      it("dispatch one message event", () => {
        const event = {
          text: "This is a test message",
          type: "message",
          user: "UXXX",
          ts: "1505227601.000491",
          channel: "CXXX",
          event_ts: "1505227601.000491",
        } as ISlackMessageEvent

        return new ConnectorTester(connector, connector.listenEvents)
          .withBody(buildEnvelope(event))
          .expectToRespond(200)
          .expectToDispatchEvent(expectedMessage(event))
          .runTest()
      })

      describe("when the message contains mentions", () => {
        it("dispatch one message event with the mentions", () => {
          const event = {
            text: "This is a test message with a mention <@UZZZ>",
            type: "message",
            user: "UXXX",
            ts: "1505227601.000491",
            channel: "CXXX",
            event_ts: "1505227601.000491",
          } as ISlackMessageEvent

          return new ConnectorTester(connector, connector.listenEvents)
            .withBody(buildEnvelope(event))
            .expectToRespond(200)
            .expectToDispatchEvent(expectedMessage(event, ["UZZZ"]))
            .runTest()
        })
      })

      describe("when the message contains attachments", () => {
        xit("adds the attachments to the message")
      })
    })
  })
})
