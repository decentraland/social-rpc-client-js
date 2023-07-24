import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  TooManyRequestsError,
  UnauthorizedError
} from './protobuff-types/decentraland/social/friendships/friendships.gen'

export class SocialClientUnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export class SocialClientBadRequestError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export class SocialClientForbiddenError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export class SocialClientInternalServerError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export class SocialClientTooManyRequestsError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export class SynapseLoginError extends Error {
  constructor(message: string) {
    super(`The synapse token could not be retrieved: ${message}`)
  }
}

type Errors = {
  internalServerError?: InternalServerError | undefined
  unauthorizedError?: UnauthorizedError | undefined
  forbiddenError?: ForbiddenError | undefined
  tooManyRequestsError?: TooManyRequestsError | undefined
  badRequestError?: BadRequestError | undefined
}

export function processErrors(response: Errors): void {
  if (response.badRequestError) {
    throw new SocialClientBadRequestError(response.badRequestError.message)
  } else if (response.forbiddenError) {
    throw new SocialClientForbiddenError(response.forbiddenError.message)
  } else if (response.internalServerError) {
    throw new SocialClientInternalServerError(response.internalServerError.message)
  } else if (response.tooManyRequestsError) {
    throw new SocialClientTooManyRequestsError(response.tooManyRequestsError.message)
  } else if (response.unauthorizedError) {
    throw new SocialClientUnauthorizedError(response.unauthorizedError.message)
  }
}

export function isErrorWithMessage(error: unknown): error is Error {
  return error !== undefined && error !== null && typeof error === 'object' && 'message' in error
}
