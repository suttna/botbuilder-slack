import { IConnector, IEvent } from "botbuilder"
import { Request, Response } from "restify"

export type RequestHandler = () => (req: Request, res: Response, next: () => void) => void

export class ConnectorTester {
  private expectations: Array<() => void> = []

  private requestBody: any
  private requestParams: any
  private requestQuery: any

  private endMock: jest.Mock<void>
  private statusMock: jest.Mock<void>
  private headerMock: jest.Mock<void>
  private onDispatchMock: jest.Mock<void>

  constructor(private connector: IConnector, private handler: RequestHandler) {
    this.endMock = jest.fn()
    this.statusMock = jest.fn()
    this.headerMock = jest.fn()
    this.onDispatchMock = jest.fn<any>()

    this.connector.onEvent(this.onDispatchMock)
  }

  public withBody(body: any): this {
    this.requestBody = body

    return this
  }

  public withParams(params: any): this {
    this.requestParams = params

    return this
  }

  public withQuery(queryParams: any): this {
    this.requestQuery = queryParams

    return this
  }

  public expectToDispatchEvent(event: IEvent): this {
    this.expectations.push(() => {
      expect(this.onDispatchMock).toHaveBeenCalledWith([event])
    })

    return this
  }

  public expectNotToDispatchEvents(): this {
    this.expectations.push(() => {
      expect(this.onDispatchMock).not.toHaveBeenCalled()
    })

    return this
  }

  public expectToRespond(status: number, body?: any): this {
    this.expectations.push(() => {
      expect(this.statusMock).toHaveBeenCalledWith(status)
      if (body) {
        expect(this.endMock).toHaveBeenCalledWith(body)
      } else {
        expect(this.endMock).toHaveBeenCalled()
      }
    })

    return this
  }

  public expectToRedirect(url: string): this {
    this.expectations.push(() => {
      expect(this.statusMock).toHaveBeenCalledWith(302)
      expect(this.headerMock).toHaveBeenCalledWith("Location", url)
    })

    return this
  }

  public then(handler: () => void) {
    this.expectations.push(handler)

    return this
  }

  public runTest() {
    return new Promise((resolve) => {
      const requestMock = jest.fn<Request>(() => ({
        body: this.requestBody,
        params: this.requestParams,
        query: this.requestQuery,
      }))

      const responseMock = jest.fn<Response>(() => ({
        end: this.endMock,
        status: this.statusMock,
        header: this.headerMock,
      }))

      this.handler.bind(this.connector)()(new requestMock(), new responseMock(), () => {
        this.expectations.forEach((expectation) => expectation())

        resolve()
      })
    })
  }
}