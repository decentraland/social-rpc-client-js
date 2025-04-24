import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  TooManyRequestsError,
  UnauthorizedError
} from './protobuff-types/decentraland/social_service/v1/social_service_v1.gen'
import {
  InternalServerError as InternalServerErrorV2,
  InvalidFriendshipAction,
  InvalidRequest as InvalidRequestV2
} from './protobuff-types/decentraland/social_service/v2/social_service_v2.gen'

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
  internalServerError?: InternalServerError | InternalServerErrorV2 | undefined
  unauthorizedError?: UnauthorizedError | undefined
  forbiddenError?: ForbiddenError | undefined
  tooManyRequestsError?: TooManyRequestsError | undefined
  badRequestError?: BadRequestError | InvalidRequestV2 | InvalidFriendshipAction | undefined
}

export function processErrors(response: Errors): void {
  if (response.badRequestError) {
    throw new SocialClientBadRequestError(response.badRequestError.message ?? 'Unknown error')
  } else if (response.forbiddenError) {
    throw new SocialClientForbiddenError(response.forbiddenError.message)
  } else if (response.internalServerError) {
    throw new SocialClientInternalServerError(response.internalServerError.message ?? 'Unknown error')
  } else if (response.tooManyRequestsError) {
    throw new SocialClientTooManyRequestsError(response.tooManyRequestsError.message)
  } else if (response.unauthorizedError) {
    throw new SocialClientUnauthorizedError(response.unauthorizedError.message)
  }
}

export function isErrorWithMessage(error: unknown): error is Error {
  return error !== undefined && error !== null && typeof error === 'object' && 'message' in error
}
