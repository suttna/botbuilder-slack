import { IConnector, IEvent } from "botbuilder"
import { IRequest, IResponse } from "../../src/http"

export type RequestHandler = () => (req: IRequest, res: IResponse, next: () => void) => void

export class ConnectorTester {
  private expectations: Array<() => void> = []

  private requestBody: any
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
      const requestMock = jest.fn<IRequest>(() => ({
        body: this.requestBody,
        query: this.requestQuery,
      }))

      const responseMock = jest.fn<IResponse>(() => ({
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
