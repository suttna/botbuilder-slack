import "jest"
import { extractMentions } from "../src/utils"

const teamId = "TXXX"

describe("utils", () => {

  describe("extractMentions", () => {

    describe("when no mentions", () => {
      it("returns an empty array", () => {
        const text = "This has no mentions"

        expect(extractMentions(text, teamId)).toHaveLength(0)
      })
    })

    describe("when their is one mention", () => {
      it("returns one mention", () => {
        const text = "Hoy are you <@UXXX>"

        expect(extractMentions(text, teamId)).toHaveLength(1)
      })

      it("returns the correct information", () => {
        const text = "Hoy are you <@UXXX>"

        expect(extractMentions(text, teamId)).toContainEqual({
          type: "mention",
          text: "<@UXXX>",
          mentioned: {
            id: `UXXX:TXXX`,
          },
        })
      })
    })

    describe("when their are mutiples mentions", () => {
      const text = "Hoy are you <@UXXX> and <@UZZZ>"

      it("returns two mentions array", () => {
        expect(extractMentions(text, teamId)).toHaveLength(2)
      })

      it("returns the correct information", () => {
        expect(extractMentions(text, teamId)).toContainEqual({
          type: "mention",
          text: "<@UXXX>",
          mentioned: {
            id: `UXXX:TXXX`,
          },
        })

        expect(extractMentions(text, teamId)).toContainEqual({
          type: "mention",
          text: "<@UZZZ>",
          mentioned: {
            id: `UZZZ:TXXX`,
          },
        })
      })
    })
  })
})
