import {
  SocialClientBadRequestError,
  SocialClientForbiddenError,
  SocialClientInternalServerError,
  SocialClientTooManyRequestsError,
  SocialClientUnauthorizedError,
  processErrors
} from '../src/errors'
import { UpdateFriendshipResponse } from '../src/protobuff-types/decentraland/social/friendships/friendships.gen'

let response: UpdateFriendshipResponse

beforeEach(() => {
  response = {}
})

describe('when processing a bad request error', () => {
  beforeEach(() => {
    response = {
      ...response,
      badRequestError: {
        message: 'Bad request'
      }
    }
  })

  it('should throw a bad request error', () => {
    expect(() => processErrors(response)).toThrowError(new SocialClientBadRequestError(response.badRequestError?.message ?? ''))
  })
})

describe('when processing a forbidden error', () => {
  beforeEach(() => {
    response = {
      ...response,
      forbiddenError: {
        message: 'Forbidden error'
      }
    }
  })

  it('should throw a forbidden error', () => {
    expect(() => processErrors(response)).toThrowError(new SocialClientForbiddenError(response.forbiddenError?.message ?? ''))
  })
})

describe('when processing an internal server error', () => {
  beforeEach(() => {
    response = {
      ...response,
      internalServerError: {
        message: 'Internal server error'
      }
    }
  })

  it('should throw an internal server error', () => {
    expect(() => processErrors(response)).toThrowError(new SocialClientInternalServerError(response.internalServerError?.message ?? ''))
  })
})

describe('when processing a too many requests error', () => {
  beforeEach(() => {
    response = {
      ...response,
      tooManyRequestsError: {
        message: 'Too many requests'
      }
    }
  })

  it('should throw a too many requests error', () => {
    expect(() => processErrors(response)).toThrowError(new SocialClientTooManyRequestsError(response.tooManyRequestsError?.message ?? ''))
  })
})

describe('when processing an unauthorized error', () => {
  beforeEach(() => {
    response = {
      ...response,
      unauthorizedError: {
        message: 'Unauthorized error'
      }
    }
  })

  it('should throw an unauthorized error', () => {
    expect(() => processErrors(response)).toThrowError(new SocialClientUnauthorizedError(response.unauthorizedError?.message ?? ''))
  })
})
