import "jest"

import { CardAction, HeroCard, IEvent, IMessage, Message } from "botbuilder"
import * as nock from "nock"
import * as qs from "qs"
import { ConnectorTester } from "./support/connector_tester"
import * as defaults from "./support/defaults"
import {
  convertBotbuilderMessageToSlackPostData,
  convertBotbuilderMessageToSlackUpdateData,
} from "./support/slack"

import {
  expectedCommandEvent,
  expectedConversationUpdateEvent,
  expectedInstallationUpdateAddEvent,
  expectedInstallationUpdateRemoveEvent,
  expectedInteractiveMessage,
  expectedMessage,
} from "./support/expect"

import {
  ISlackCommandEnvelope, ISlackEvent, ISlackInteractiveMessageEnvelope, ISlackMessageEvent,
} from "../src/interfaces"
import { ISlackAddress, SlackConnector } from "../src/slack_connector"

// Useful for debugging slack api calls
//
// nock.disableNetConnect()
// nock.recorder.rec()

describe("SlackConnector", () => {
  let address: ISlackAddress
  let connector: SlackConnector
  let onDispatchEvents: (events: IEvent[], cb?: (err: Error) => void) => void

  let onDispatchMock: jest.Mock<void>

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
      dataCache: defaults.defaultDataCache,
    })

    address = defaults.defaultAddress

    onDispatchMock = jest.fn<any>()
    onDispatchEvents = onDispatchMock

    connector.onEvent(onDispatchEvents)
  })

  describe("send", () => {
    let msg: IMessage

    beforeEach(() => {
      // INFO: Botbuilder auto generates an id before creating the message in Slack.
      //   We need to be sure that we're updating that fake id and returning the new one from Slack.
      address.id = "1507762653.000073"
    })

    describe("when sending an empty text", () => {
      beforeEach(() => {
        msg = new Message().address(address).text("").toMessage()
      })

      it("does not invoke the slack api", (done) => {
        const stub = nock("https://slack.com").post("/api/chat.postMessage").reply(200)

        connector.send([msg], (err, addresses) => {
          expect(err.message).toBe("Messages without content are not allowed.")
          expect(stub.isDone()).toBeFalsy()

          done()
        })
      })
    })

    describe("when sending a text only message", () => {
      beforeEach(() => {
        msg = new Message().address(address).text("Testing...").toMessage()
      })

      it("invokes the slack api", (done) => {
        const ts              = "1405895017.000506"
        const newConversation = { id: `${address.conversation.id};messageid=${ts}`, isGroup: true }

        const stub = nock("https://slack.com")
          .post("/api/chat.postMessage", convertBotbuilderMessageToSlackPostData(msg))
          .reply(200, { ok: true, ts, channel: "CXXX" })

        connector.send([msg], (err, addresses) => {
          expect((addresses[0] as ISlackAddress).id).toBe(ts)
          expect(addresses[0]).toMatchObject({
            ...address,
            conversation: newConversation,
            id: ts,
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
          .address(address)
          .addAttachment(hero)
          .text("This is another possible text")
          .toMessage()
      })

      it("invokes the slack api", (done) => {
        const ts              = "1405895017.000506"
        const newConversation = { id: `${address.conversation.id};messageid=${ts}`, isGroup: true }

        const stub = nock("https://slack.com")
          .post("/api/chat.postMessage", convertBotbuilderMessageToSlackPostData(msg))
          .reply(200, { ok: true, ts, channel: "CXXX" })

        connector.send([msg], (err, addresses) => {
          expect((addresses[0] as ISlackAddress).id).toBe(ts)
          expect(addresses[0]).toMatchObject({
            ...address,
            conversation: newConversation,
            id: ts,
          })
          expect(stub.isDone()).toBeTruthy()

          done()
        })
      })
    })

    describe("when API returns an error", () => {
      beforeEach(() => {
        msg = new Message().address(address).text("Testing...").toMessage()
      })

      it("invokes the slack api and returns the correct error message", (done) => {
        const stub = nock("https://slack.com")
          .post("/api/chat.postMessage", convertBotbuilderMessageToSlackPostData(msg))
          .reply(200, { ok: false, error: "channel_not_found" })

        connector.send([msg], (err, addresses) => {
          expect(err.message).toBe("channel_not_found")
          expect(stub.isDone()).toBeTruthy()

          done()
        })
      })
    })

    describe("when sending a endOfConversation message type", () => {
      beforeEach(() => {
        msg = { type: "endOfConversation", address } as IMessage
      })

      it("doesn't invoke the slack api", (done) => {
        const stub = nock("https://slack.com")
          .post("/api/chat.postMessage")
          .reply(200)

        connector.send([msg], (err, addresses) => {
          expect(addresses[0]).toMatchObject(address)
          expect(stub.isDone()).toBeFalsy()
          done()
        })
      })
    })
  })

  describe("startConversation", () => {
    it("invokes the slack api", (done) => {
      const stub = nock("https://slack.com")
        .post("/api/im.open", { user: "UXXX", token: "XXX" })
        .reply(200, { ok: true, channel: { id: "DXXX" } })

      connector.startConversation(address, (err, newAddress) => {
        expect(newAddress).toMatchObject({
          ...address,
          conversation: { id: "BXXX:TXXX:DXXX" },
        })

        expect(stub.isDone()).toBeTruthy()
        done()
      })
    })
  })

  describe("update", () => {
    let msg: IMessage

    describe("when updating a text only message", () => {
      beforeEach(() => {
        address.id = "1111"

        msg = new Message().address(address).text("Testing...").toMessage()
      })

      it("invokes the slack api", (done) => {
        const stub = nock("https://slack.com")
          .post("/api/chat.update", convertBotbuilderMessageToSlackUpdateData(msg))
          .reply(200, { ok: true, ts: "1111", channel: "CXXX" })

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
          .post("/api/chat.update", convertBotbuilderMessageToSlackUpdateData(msg))
          .reply(200, { ok: true, ts: "1111", channel: "CXXX" })

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

    beforeEach(() => {
      address.id = "1111"

      msg = new Message().address(address).text("Testing...").toMessage()
    })

    it("invokes the slack api", (done) => {
      const stub = nock("https://slack.com")
        .post("/api/chat.delete", { ts: "1111", channel: "CXXX", token: "XXX" })
        .reply(200, { ok: true, ts: "1111", channel: "CXXX" })

      connector.delete(msg.address, (err) => {
        expect(err).toBeNull()

        expect(stub.isDone()).toBeTruthy()
        done()
      })
    })
  })

  describe("startReplyChain", () => {
    let msg: IMessage

    describe("when sending a text only message", () => {
      beforeEach(() => {
        msg = new Message().address(address).text("Testing...").toMessage()
      })

      it("invokes the slack api", async () => {
        const ts              = "1405895017.000506"
        const newConversation = { id: `${address.conversation.id};messageid=${ts}`, isGroup: true }

        const stub = nock("https://slack.com")
          .post("/api/chat.postMessage", convertBotbuilderMessageToSlackPostData(msg))
          .reply(200, { ok: true, ts, channel: "CXXX" })

        const newAddress = await connector.startReplyChain(msg)

        expect((newAddress as ISlackAddress).id).toBe(ts)
        expect(newAddress).toMatchObject({
          ...address,
          conversation: newConversation,
          id: ts,
        })
        expect(stub.isDone()).toBeTruthy()
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
          .address(address)
          .addAttachment(hero)
          .text("This is another possible text")
          .toMessage()
      })

      it("invokes the slack api", async () => {
        const ts              = "1405895017.000506"
        const newConversation = { id: `${address.conversation.id};messageid=${ts}`, isGroup: true }

        const stub = nock("https://slack.com")
          .post("/api/chat.postMessage", convertBotbuilderMessageToSlackPostData(msg))
          .reply(200, { ok: true, ts, channel: "CXXX" })

        const newAddress = await connector.startReplyChain(msg)

        expect((newAddress as ISlackAddress).id).toBe(ts)
        expect(newAddress).toMatchObject({
          ...address,
          conversation: newConversation,
          id: ts,
        })
        expect(stub.isDone()).toBeTruthy()
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
            .post(
              "/api/oauth.access",
              {
                redirect_uri: "https://test.com/oauth", client_id: "CID", client_secret: "CSEC", code: "CODE",
              },
            ).reply(200, { ok: false })

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
            .post(
              "/api/oauth.access",
              {
                redirect_uri: "https://test.com/oauth", client_id: "CID", client_secret: "CSEC", code: "CODE",
              },
            ).reply(200, { ok: true, ...partialAccessResult })

          const botStub = nock("https://slack.com")
            .post("/api/users.info", { user: "UBBB", token: "xoxp-user" })
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
            .expectToDispatchEvent(expectedInstallationUpdateAddEvent(partialAccessResult))
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

    describe("when an event is received", () => {
      let envelope: any
      let action: any

      beforeEach(() => {
        action = {
          name: "Questions",
          type: "button",
          text: "Questions",
          value: "action?prompt-menu=questions",
        }

        envelope = {
          ...defaults.defaultInteractiveMessageEnvelope,
          actions: [ action ],
        }
      })

      it("dispatch a message event", () => {
        return new ConnectorTester(connector, connector.listenInteractiveMessages)
          .withBody(buildPayload(envelope))
          .expectToRespond(200)
          .expectToDispatchEvent(expectedInteractiveMessage(envelope))
          .runTest()
      })

      describe("and was triggered within a thread", () => {
        beforeEach(() => {
          envelope.original_message.thread_ts = "1505227601.001989"
        })

        it("dispatch a message event having the correct messageid param", () => {
          return new ConnectorTester(connector, connector.listenInteractiveMessages)
            .withBody(buildPayload(envelope))
            .expectToRespond(200)
            .expectToDispatchEvent(expectedInteractiveMessage(envelope))
            .runTest()
        })
      })
    })
  })

  describe("listenEvents", () => {
    const buildEnvelope = (event: ISlackEvent) => {
      return { ...defaults.defaultMessageEnvelope, event }
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
            .expectToDispatchEvent(expectedInstallationUpdateRemoveEvent(event))
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
      let event: ISlackMessageEvent

      beforeEach(() => {
        event = {
          text: "This is a test message",
          type: "message",
          user: "UXXX",
          ts: "1505227601.000491",
          channel: "CXXX",
          event_ts: "1505227601.000491",
        } as ISlackMessageEvent
      })

      it("dispatch one message event", () => {
        return new ConnectorTester(connector, connector.listenEvents)
          .withBody(buildEnvelope(event))
          .expectToRespond(200)
          .expectToDispatchEvent(expectedMessage(event))
          .runTest()
      })

      describe("and was sent within a thread", () => {
        it("dispatch one message event with the correct messageid param", () => {
          event.thread_ts = "1505227601.001989"

          return new ConnectorTester(connector, connector.listenEvents)
            .withBody(buildEnvelope(event))
            .expectToRespond(200)
            .expectToDispatchEvent(expectedMessage(event))
            .runTest()
        })
      })

      describe("when the message contains mentions", () => {
        it("dispatch one message event with the mentions", () => {
          event.text = "This is a test message with a mention <@UZZZ>"

          return new ConnectorTester(connector, connector.listenEvents)
            .withBody(buildEnvelope(event))
            .expectToRespond(200)
            .expectToDispatchEvent(expectedMessage(event, [{ id: "UZZZ", name: "User Z" }]))
            .runTest()
        })
      })

      describe("when the message contains attachments", () => {
        xit("adds the attachments to the message")
      })
    })
  })
})
