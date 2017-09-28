/* tslint:disable max-classes-per-file */
export class SlackConnectorError extends Error {
  public metadata: any

  constructor(message?: string) {
    super(message)

    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class UnauthorizedError extends SlackConnectorError {
  public get name() {
    return "UnauthorizedError"
  }
}

export class OAuthAccessDeniedError extends SlackConnectorError {
  public get name() {
    return "OAuthAccessDeniedError"
  }
}
/* tslint:enable max-classes-per-file */
