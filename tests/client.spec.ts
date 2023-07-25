import { AuthIdentity } from '@dcl/crypto'
import type { RpcClient, RpcClientPort, Transport } from '@dcl/rpc'
import { createRpcClient } from '@dcl/rpc/dist/client'
import { loadService } from '@dcl/rpc/dist/codegen'
import { createSocialClient } from '../src/client'
import { SocialClientBadRequestError, SocialClientInternalServerError } from '../src/errors'
import {
  FriendshipsServiceDefinition,
  MutualFriendsPayload,
  Payload,
  RequestEventsResponse,
  SubscribeFriendshipEventsUpdatesResponse,
  UpdateFriendshipResponse,
  UsersResponse
} from '../src/protobuff-types/decentraland/social/friendships/friendships.gen'
import { getSynapseToken } from '../src/synapse'
import { createWebSocketsTransport } from '../src/transport'

jest.mock('../src/synapse')
jest.mock('../src/transport')
jest.mock('@dcl/rpc/dist/codegen')
jest.mock('@dcl/rpc/dist/client')

const createRpcClientMock = jest.mocked(createRpcClient)
const getSynapseTokenMock = jest.mocked(getSynapseToken)
const createWebSocketsTransportMock = jest.mocked(createWebSocketsTransport)
const loadServiceMock = jest.mocked(loadService)

describe('when creating a new client', () => {
  let synapseUrl: string
  let socialClientRpcUrl: string
  let userAddress: string
  let accessToken: string
  let identity: AuthIdentity
  let transport: Transport
  let rpcClient: RpcClient
  let port: RpcClientPort
  let loadServiceResult: ReturnType<typeof loadService<object, FriendshipsServiceDefinition>>
  let result: Awaited<ReturnType<typeof createSocialClient>>
  let targetAddress: string
  let updateFriendshipEvent: jest.MockedFunction<
    ReturnType<typeof loadService<object, FriendshipsServiceDefinition>>['updateFriendshipEvent']
  >
  let getRequestEvents: jest.MockedFunction<ReturnType<typeof loadService<object, FriendshipsServiceDefinition>>['getRequestEvents']>
  let getFriends: jest.MockedFunction<ReturnType<typeof loadService<object, FriendshipsServiceDefinition>>['getFriends']>
  let getMutualFriends: jest.MockedFunction<ReturnType<typeof loadService<object, FriendshipsServiceDefinition>>['getMutualFriends']>
  let subscribeFriendshipEventsUpdates: jest.MockedFunction<
    ReturnType<typeof loadService<object, FriendshipsServiceDefinition>>['subscribeFriendshipEventsUpdates']
  >

  beforeEach(async () => {
    synapseUrl = 'https://social.decentraland.org'
    socialClientRpcUrl = 'ws:///social-service.decentraland.org'
    userAddress = '0x0'
    identity = {} as AuthIdentity
    accessToken = 'aToken'
    transport = { close: jest.fn() } as unknown as Transport
    port = {} as RpcClientPort
    rpcClient = { createPort: jest.fn().mockResolvedValue(port) } as RpcClient
    updateFriendshipEvent = jest.fn()
    getRequestEvents = jest.fn()
    getFriends = jest.fn()
    getMutualFriends = jest.fn()
    subscribeFriendshipEventsUpdates = jest.fn()
    targetAddress = '0x1'
    loadServiceResult = {
      updateFriendshipEvent,
      getRequestEvents,
      getFriends,
      getMutualFriends,
      subscribeFriendshipEventsUpdates
    } as unknown as ReturnType<typeof loadService<object, FriendshipsServiceDefinition>>
    createWebSocketsTransportMock.mockReturnValueOnce(transport)
    createRpcClientMock.mockResolvedValueOnce(rpcClient)
    getSynapseTokenMock.mockResolvedValueOnce(accessToken)
    loadServiceMock.mockReturnValueOnce(loadServiceResult)
    result = await createSocialClient(synapseUrl, socialClientRpcUrl, userAddress, identity)
  })

  it('should connect to the Social RPC server', () => {
    expect(getSynapseTokenMock).toBeCalledWith(synapseUrl, userAddress, identity)
    expect(createWebSocketsTransportMock).toHaveBeenCalledWith(socialClientRpcUrl)
    expect(createRpcClientMock).toHaveBeenCalledWith(transport)
    expect(loadServiceMock).toHaveBeenCalledWith(port, expect.anything())
  })

  describe('and using the client to make a friendship request', () => {
    let response: UpdateFriendshipResponse

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          badRequestError: { message: 'anErrorOccurred' }
        }
        updateFriendshipEvent.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.requestFriendship(targetAddress)).rejects.toThrowError(
          new SocialClientBadRequestError(response.badRequestError?.message ?? '')
        )
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          event: {
            request: { user: { address: targetAddress }, createdAt: Date.now() }
          }
        }
        updateFriendshipEvent.mockResolvedValueOnce(response)
      })

      it('should resolve with the request event', async () => {
        await expect(result.requestFriendship(targetAddress)).resolves.toEqual(response.event)
        expect(updateFriendshipEvent).toHaveBeenCalledWith(
          expect.objectContaining({ event: { request: { user: { address: targetAddress } } } })
        )
      })
    })
  })

  describe('and using the client to cancel a friendship request', () => {
    let response: UpdateFriendshipResponse

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          badRequestError: { message: 'anErrorOccurred' }
        }
        updateFriendshipEvent.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.cancelFriendshipRequest(targetAddress)).rejects.toThrowError(
          new SocialClientBadRequestError(response.badRequestError?.message ?? '')
        )
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          event: {
            cancel: { user: { address: targetAddress } }
          }
        }
        updateFriendshipEvent.mockResolvedValueOnce(response)
      })

      it('should resolve with the request event', async () => {
        await expect(result.cancelFriendshipRequest(targetAddress)).resolves.toEqual(response.event)
        expect(updateFriendshipEvent).toHaveBeenCalledWith(
          expect.objectContaining({ event: { cancel: { user: { address: targetAddress } } } })
        )
      })
    })
  })

  describe('and using the client to reject a friendship request', () => {
    let response: UpdateFriendshipResponse

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          badRequestError: { message: 'anErrorOccurred' }
        }
        updateFriendshipEvent.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.rejectFriendshipRequest(targetAddress)).rejects.toThrowError(
          new SocialClientBadRequestError(response.badRequestError?.message ?? '')
        )
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          event: {
            reject: { user: { address: targetAddress } }
          }
        }
        updateFriendshipEvent.mockResolvedValueOnce(response)
      })

      it('should resolve with the request event', async () => {
        await expect(result.rejectFriendshipRequest(targetAddress)).resolves.toEqual(response.event)
        expect(updateFriendshipEvent).toHaveBeenCalledWith(
          expect.objectContaining({ event: { reject: { user: { address: targetAddress } } } })
        )
      })
    })
  })

  describe('and using the client to accept a friendship request', () => {
    let response: UpdateFriendshipResponse

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          badRequestError: { message: 'anErrorOccurred' }
        }
        updateFriendshipEvent.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.acceptFriendshipRequest(targetAddress)).rejects.toThrowError(
          new SocialClientBadRequestError(response.badRequestError?.message ?? '')
        )
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          event: {
            accept: { user: { address: targetAddress } }
          }
        }
        updateFriendshipEvent.mockResolvedValueOnce(response)
      })

      it('should resolve with the request event', async () => {
        await expect(result.acceptFriendshipRequest(targetAddress)).resolves.toEqual(response.event)
        expect(updateFriendshipEvent).toHaveBeenCalledWith(
          expect.objectContaining({ event: { accept: { user: { address: targetAddress } } } })
        )
      })
    })
  })

  describe('and using the client to remove a friend', () => {
    let response: UpdateFriendshipResponse

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          badRequestError: { message: 'anErrorOccurred' }
        }
        updateFriendshipEvent.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.removeFriend(targetAddress)).rejects.toThrowError(
          new SocialClientBadRequestError(response.badRequestError?.message ?? '')
        )
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          event: {
            delete: { user: { address: targetAddress } }
          }
        }
        updateFriendshipEvent.mockResolvedValueOnce(response)
      })

      it('should resolve with the request event', async () => {
        await expect(result.removeFriend(targetAddress)).resolves.toEqual(response.event)
        expect(updateFriendshipEvent).toHaveBeenCalledWith(
          expect.objectContaining({ event: { delete: { user: { address: targetAddress } } } })
        )
      })
    })
  })

  describe('and using the client to get the request events', () => {
    let response: RequestEventsResponse

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        getRequestEvents.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.getRequestEvents()).rejects.toThrowError(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          events: {
            incoming: { total: 0, items: [] },
            outgoing: { total: 0, items: [] }
          }
        }
        getRequestEvents.mockResolvedValueOnce(response)
      })

      it('should resolve with the request event', async () => {
        await expect(result.getRequestEvents()).resolves.toEqual(response.events)
        expect(getRequestEvents).toHaveBeenCalledWith({
          synapseToken: accessToken
        })
      })
    })
  })

  describe('and using the client to disconnect', () => {
    it('should close the websocket transport', () => {
      result.disconnect()
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transport.close as jest.Mock).toHaveBeenCalled()
    })
  })

  describe("when getting the user's friends", () => {
    describe('and the server returns an error', () => {
      beforeEach(() => {
        getFriends.mockImplementationOnce(async function* (_request: Payload) {
          const userResponse: UsersResponse = {
            internalServerError: {
              message: 'anErrorOccurred'
            }
          }
          yield userResponse
        })
      })

      it('should reject with the error', () => {
        const friendsGenerator = result.getFriends()
        return expect(friendsGenerator.next()).rejects.toThrowError(new SocialClientInternalServerError('anErrorOccurred'))
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        getFriends.mockImplementationOnce(async function* (_request: Payload) {
          const userResponse: UsersResponse = {
            users: {
              users: [{ address: '0x1' }]
            }
          }
          yield userResponse
        })
      })

      it('should return the friends', async () => {
        const friendsGenerator = result.getFriends()
        await expect(friendsGenerator.next()).resolves.toEqual({ done: false, value: [{ address: '0x1' }] })
        await expect(friendsGenerator.next()).resolves.toEqual({ done: true, value: undefined })
      })
    })
  })

  describe("when getting the user's mutual friends", () => {
    let targetAddress: string
    beforeEach(() => {
      targetAddress = '0x1'
    })

    describe('and the server returns an error', () => {
      beforeEach(() => {
        getMutualFriends.mockImplementationOnce(async function* (_request: MutualFriendsPayload) {
          const userResponse: UsersResponse = {
            internalServerError: {
              message: 'anErrorOccurred'
            }
          }
          yield userResponse
        })
      })

      it('should reject with the error', () => {
        const friendsGenerator = result.getMutualFriends(targetAddress)
        return expect(friendsGenerator.next()).rejects.toThrowError(new SocialClientInternalServerError('anErrorOccurred'))
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        getMutualFriends.mockImplementationOnce(async function* (_request: MutualFriendsPayload) {
          const userResponse: UsersResponse = {
            users: {
              users: [{ address: '0x1' }]
            }
          }
          yield userResponse
        })
      })

      it('should return the mutual friends', async () => {
        const friendsGenerator = result.getMutualFriends(targetAddress)
        await expect(friendsGenerator.next()).resolves.toEqual({ done: false, value: [{ address: '0x1' }] })
        await expect(friendsGenerator.next()).resolves.toEqual({ done: true, value: undefined })
      })
    })
  })

  describe('when subscribing to friendship requests', () => {
    describe('and the server returns an error', () => {
      beforeEach(() => {
        subscribeFriendshipEventsUpdates.mockImplementationOnce(async function* (_request: Payload) {
          const response: SubscribeFriendshipEventsUpdatesResponse = {
            internalServerError: {
              message: 'anErrorOccurred'
            }
          }
          yield response
        })
      })

      it('should reject with the error', () => {
        const friendsGenerator = result.subscribeToFriendshipRequests()
        return expect(friendsGenerator.next()).rejects.toThrowError(new SocialClientInternalServerError('anErrorOccurred'))
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        subscribeFriendshipEventsUpdates.mockImplementationOnce(async function* (_request: Payload) {
          const response: SubscribeFriendshipEventsUpdatesResponse = {
            events: {
              responses: [
                {
                  request: {
                    user: { address: '0x1' },
                    createdAt: 0
                  }
                }
              ]
            }
          }
          yield response
        })
      })

      it('should return the friendship requests', async () => {
        const friendsGenerator = result.subscribeToFriendshipRequests()
        await expect(friendsGenerator.next()).resolves.toEqual({
          done: false,
          value: [
            {
              request: {
                user: { address: '0x1' },
                createdAt: 0
              }
            }
          ]
        })
        await expect(friendsGenerator.next()).resolves.toEqual({ done: true, value: undefined })
      })
    })
  })
})
