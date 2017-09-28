import { Response } from "restify"

export function handleUnauthorizedRequest(res: Response, next: () => void) {
  res.status(403)
  res.end()
  next()
}

export function handleInternalError(res: Response, next: () => void) {
  res.status(500)
  res.end()
  next()
}

export function handleSuccessfulRequest(res: Response, next: () => void, data?: string) {
  res.status(200)
  res.end(data)
  next()
}

export function handleRedirectRequest(url: string, res: Response, next: () => void) {
  res.header("Location", url)
  res.status(302)
  res.end()
  next()
}
