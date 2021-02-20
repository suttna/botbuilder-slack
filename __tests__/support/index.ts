// Sane error messages!!!
process.on("unhandledRejection", (reason, p) => {
  console.error("Unhandled Rejection at:", p, "reason:", reason)
})

afterAll(async (done) => {
  if (!process.stdout.write("")) {
    process.stdout.once("drain", () => { done() })
  }
})
