import "jest"
import { extractMentions } from "../src/utils"
import * as defaults from "./support/defaults"

const teamId    = defaults.defaultTeam
const botId     = defaults.defaultBot
const botUserId = defaults.defaultBotUser
const dataCache = defaults.defaultDataCache

describe("utils", () => {
  describe("extractMentions", () => {
    describe("when no mentions", () => {
      it("returns an empty array", async () => {
        const text = "This has no mentions"

        expect(await extractMentions({ text, teamId, botId, botUserId })).toHaveLength(0)
      })
    })

    describe("when their is one mention", () => {
      it("returns one mention", async () => {
        const text = "Hoy are you <@UXXX>"

        expect(await extractMentions({ text, teamId, botId, botUserId })).toHaveLength(1)
      })

      it("returns the correct information", async () => {
        const text = "Hoy are you <@UXXX>"

        expect(await extractMentions({ text, teamId, botId, botUserId, dataCache })).toContainEqual({
          type: "mention",
          text: "<@UXXX>",
          mentioned: {
            id: `UXXX:TXXX`,
            name: "User X",
          },
        })
      })

      describe("and a cache was provided", () => {
        it("returns the mention with the cached name", async () => {
          const text = "Hoy are you <@UXXX>"

          expect(await extractMentions({ text, teamId, botId, botUserId })).toContainEqual({
            type: "mention",
            text: "<@UXXX>",
            mentioned: {
              id: `UXXX:TXXX`,
            },
          })
        })
      })
    })

    describe("when their are mutiples mentions", () => {
      const text = "Hoy are you <@UXXX> and <@UZZZ>"

      it("returns two mentions array", async () => {
        expect(await extractMentions({ text, teamId, botId, botUserId })).toHaveLength(2)
      })

      it("returns the correct information", async () => {
        expect(await extractMentions({ text, teamId, botId, botUserId })).toEqual(
          expect.arrayContaining([
            {
              type: "mention",
              text: "<@UXXX>",
              mentioned: {
                id: `UXXX:TXXX`,
              },
            },
            {
              type: "mention",
              text: "<@UZZZ>",
              mentioned: {
                id: `UZZZ:TXXX`,
              },
            },
          ]),
        )
      })

      describe("and a cache was provided", () => {
        it("returns the mention with the cached name", async () => {
          expect(await extractMentions({ text, teamId, botId, botUserId, dataCache })).toEqual(
            expect.arrayContaining([
              {
                type: "mention",
                text: "<@UXXX>",
                mentioned: {
                  id: `UXXX:TXXX`,
                  name: "User X",
                },
              },
              {
                type: "mention",
                text: "<@UZZZ>",
                mentioned: {
                  id: `UZZZ:TXXX`,
                  name: "User Z",
                },
              },
            ]),
          )
        })
      })
    })
  })
})
