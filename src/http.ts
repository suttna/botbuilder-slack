export interface IResponse {
  status(code: number): void
  end(body?: any): void
  header(key: string, value: string): void
}

export interface IRequest {
  query: any
  params: any
  body: any
}

export function handleUnauthorizedRequest(res: IResponse, next: () => void) {
  res.status(403)
  res.end()
  next()
}

export function handleInternalError(res: IResponse, next: () => void) {
  res.status(500)
  res.end()
  next()
}

export function handleSuccessfulRequest(res: IResponse, next: () => void, data?: string) {
  res.status(200)
  res.end(data)
  next()
}

export function handleRedirectRequest(url: string, res: IResponse, next: () => void) {
  res.header("Location", url)
  res.status(302)
  res.end()
  next()
}
