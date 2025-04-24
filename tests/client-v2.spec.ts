import { Wallet } from 'ethers'
import { Authenticator } from '@dcl/crypto'
import type { RpcClient, RpcClientPort, Transport } from '@dcl/rpc'
import { createRpcClient } from '@dcl/rpc/dist/client'
import { loadService } from '@dcl/rpc/dist/codegen'
import { AuthIdentity } from 'decentraland-crypto-fetch'
import { createSocialClientV2 } from '../src/client-v2'
import { SocialClientInternalServerError } from '../src/errors'
import {
  BlockUserPayload,
  BlockUserResponse,
  GetBlockedUsersPayload,
  GetBlockedUsersResponse,
  GetBlockingStatusResponse,
  GetFriendshipRequestsPayload,
  GetFriendshipStatusPayload,
  GetFriendshipStatusResponse,
  GetFriendsPayload,
  GetMutualFriendsPayload,
  GetPrivateMessagesSettingsPayload,
  GetPrivateMessagesSettingsResponse,
  GetSocialSettingsResponse,
  PaginatedFriendshipRequestsResponse,
  PaginatedFriendsProfilesResponse,
  SocialServiceDefinition,
  UnblockUserPayload,
  UnblockUserResponse,
  UpsertFriendshipPayload,
  UpsertFriendshipResponse,
  UpsertSocialSettingsPayload,
  UpsertSocialSettingsResponse,
  User
} from '../src/protobuff-types/decentraland/social_service/v2/social_service_v2.gen'
import { Empty } from '../src/protobuff-types/google/protobuf/empty.gen'
import { createWebSocketsTransport } from '../src/transport'

jest.mock('../src/transport')
jest.mock('@dcl/rpc/dist/codegen')
jest.mock('@dcl/rpc/dist/client')

const createRpcClientMock = jest.mocked(createRpcClient)
const createWebSocketsTransportMock = jest.mocked(createWebSocketsTransport)
const loadServiceMock = jest.mocked(loadService)

describe('when creating a new client v2', () => {
  let socialClientRpcUrl: string
  let identity: AuthIdentity
  let transport: Transport & { connect: () => void; sendMessage: jest.Mock; on: jest.Mock; close: jest.Mock }
  let rpcClient: RpcClient
  let port: RpcClientPort
  let loadServiceResult: ReturnType<typeof loadService<object, SocialServiceDefinition>>
  let result: Awaited<ReturnType<typeof createSocialClientV2>>
  let targetAddress: string

  // Mock methods for the service
  let getFriends: jest.MockedFunction<ReturnType<typeof loadService<object, SocialServiceDefinition>>['getFriends']>
  let getPendingFriendshipRequests: jest.MockedFunction<
    ReturnType<typeof loadService<object, SocialServiceDefinition>>['getPendingFriendshipRequests']
  >
  let getSentFriendshipRequests: jest.MockedFunction<
    ReturnType<typeof loadService<object, SocialServiceDefinition>>['getSentFriendshipRequests']
  >
  let getFriendshipStatus: jest.MockedFunction<ReturnType<typeof loadService<object, SocialServiceDefinition>>['getFriendshipStatus']>
  let getMutualFriends: jest.MockedFunction<ReturnType<typeof loadService<object, SocialServiceDefinition>>['getMutualFriends']>
  let upsertFriendship: jest.MockedFunction<ReturnType<typeof loadService<object, SocialServiceDefinition>>['upsertFriendship']>
  let subscribeToFriendConnectivityUpdates: jest.MockedFunction<
    ReturnType<typeof loadService<object, SocialServiceDefinition>>['subscribeToFriendConnectivityUpdates']
  >
  let subscribeToFriendshipUpdates: jest.MockedFunction<
    ReturnType<typeof loadService<object, SocialServiceDefinition>>['subscribeToFriendshipUpdates']
  >
  let getSocialSettings: jest.MockedFunction<ReturnType<typeof loadService<object, SocialServiceDefinition>>['getSocialSettings']>
  let upsertSocialSettings: jest.MockedFunction<ReturnType<typeof loadService<object, SocialServiceDefinition>>['upsertSocialSettings']>
  let getPrivateMessagesSettings: jest.MockedFunction<
    ReturnType<typeof loadService<object, SocialServiceDefinition>>['getPrivateMessagesSettings']
  >
  let subscribeToBlockUpdates: jest.MockedFunction<
    ReturnType<typeof loadService<object, SocialServiceDefinition>>['subscribeToBlockUpdates']
  >
  let getBlockingStatus: jest.MockedFunction<ReturnType<typeof loadService<object, SocialServiceDefinition>>['getBlockingStatus']>
  let getBlockedUsers: jest.MockedFunction<ReturnType<typeof loadService<object, SocialServiceDefinition>>['getBlockedUsers']>
  let blockUser: jest.MockedFunction<ReturnType<typeof loadService<object, SocialServiceDefinition>>['blockUser']>
  let unblockUser: jest.MockedFunction<ReturnType<typeof loadService<object, SocialServiceDefinition>>['unblockUser']>

  beforeEach(async () => {
    socialClientRpcUrl = 'ws:///social-service-v2.decentraland.org'

    const wallet = Wallet.createRandom()
    const payload = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey
    }

    identity = await Authenticator.initializeAuthChain(wallet.address, payload, 60 * 60 * 24 * 30, message => wallet.signMessage(message))
    targetAddress = '0x1'

    // Set up the transport mock
    transport = {
      close: jest.fn(),
      connect: jest.fn(),
      sendMessage: jest.fn(),
      on: jest.fn()
    } as unknown as Transport & { connect: () => void; sendMessage: jest.Mock; on: jest.Mock; close: jest.Mock }

    // Set up port and rpc client mocks
    port = {} as RpcClientPort
    rpcClient = { createPort: jest.fn().mockResolvedValue(port) } as RpcClient

    // Mock all service methods
    getFriends = jest.fn()
    getPendingFriendshipRequests = jest.fn()
    getSentFriendshipRequests = jest.fn()
    getFriendshipStatus = jest.fn()
    getMutualFriends = jest.fn()
    upsertFriendship = jest.fn()
    subscribeToFriendConnectivityUpdates = jest.fn()
    subscribeToFriendshipUpdates = jest.fn()
    getSocialSettings = jest.fn()
    upsertSocialSettings = jest.fn()
    getPrivateMessagesSettings = jest.fn()
    subscribeToBlockUpdates = jest.fn()
    getBlockingStatus = jest.fn()
    getBlockedUsers = jest.fn()
    blockUser = jest.fn()
    unblockUser = jest.fn()

    // Set up the loadService result
    loadServiceResult = {
      getFriends,
      getPendingFriendshipRequests,
      getSentFriendshipRequests,
      getFriendshipStatus,
      getMutualFriends,
      upsertFriendship,
      subscribeToFriendConnectivityUpdates,
      subscribeToFriendshipUpdates,
      getSocialSettings,
      upsertSocialSettings,
      getPrivateMessagesSettings,
      subscribeToBlockUpdates,
      getBlockingStatus,
      getBlockedUsers,
      blockUser,
      unblockUser
    } as unknown as ReturnType<typeof loadService<object, SocialServiceDefinition>>

    // Set up mocks
    createWebSocketsTransportMock.mockReturnValueOnce(transport)
    createRpcClientMock.mockResolvedValueOnce(rpcClient)
    loadServiceMock.mockReturnValueOnce(loadServiceResult)

    // Simulate the connect event and callback invocation
    transport.on.mockImplementation((event, callback) => {
      if (event === 'connect') {
        setTimeout(() => callback(), 0)
      }
      return transport
    })

    // Create the client
    result = await createSocialClientV2(socialClientRpcUrl, identity)
    await result.connect()
  })

  it('should connect to the Social RPC server', () => {
    expect(createWebSocketsTransportMock).toHaveBeenCalledWith(socialClientRpcUrl)
    expect(transport.connect).toHaveBeenCalled()
    expect(createRpcClientMock).toHaveBeenCalledWith(transport)
    expect(loadServiceMock).toHaveBeenCalledWith(port, expect.anything())
    expect(transport.sendMessage).toHaveBeenCalled()
  })

  describe('and setting up event listeners', () => {
    it('should set up onDisconnect correctly', () => {
      const callback = jest.fn()
      result.onDisconnect(callback)
      expect(transport.on).toHaveBeenCalledWith('close', expect.any(Function))
    })

    it('should set up onConnectionError correctly', () => {
      const callback = jest.fn()
      result.onConnectionError(callback)
      expect(transport.on).toHaveBeenCalledWith('error', expect.any(Function))
    })
  })

  describe('and using the client to disconnect', () => {
    it('should close the websocket transport', () => {
      result.disconnect()
      expect(transport.close).toHaveBeenCalled()
    })
  })

  describe('when getting friends', () => {
    let response: PaginatedFriendsProfilesResponse

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          friends: [
            {
              address: targetAddress,
              name: 'User1',
              hasClaimedName: true,
              profilePictureUrl: 'https://example.com/profile.jpg'
            }
          ],
          paginationData: { page: 0, total: 1 }
        }
        getFriends.mockResolvedValueOnce(response)
      })

      it('should return the friends', async () => {
        await expect(result.getFriends()).resolves.toEqual(response)
        expect(getFriends).toHaveBeenCalledWith(GetFriendsPayload.create({ pagination: undefined }))
      })
    })
  })

  describe('when getting pending friendship requests', () => {
    let response: PaginatedFriendshipRequestsResponse

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          requests: {
            requests: [
              {
                friend: {
                  address: targetAddress,
                  name: 'User1',
                  hasClaimedName: true,
                  profilePictureUrl: 'https://example.com/profile.jpg'
                },
                message: 'Hello',
                createdAt: 123456789,
                id: '1'
              }
            ]
          },
          paginationData: { page: 0, total: 1 }
        }
        getPendingFriendshipRequests.mockResolvedValueOnce(response)
      })

      it('should return the pending requests', async () => {
        await expect(result.getPendingFriendshipRequests()).resolves.toEqual(response)
        expect(getPendingFriendshipRequests).toHaveBeenCalledWith(GetFriendshipRequestsPayload.create({ pagination: undefined }))
      })
    })
  })

  describe('when getting sent friendship requests', () => {
    let response: PaginatedFriendshipRequestsResponse

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        getSentFriendshipRequests.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.getSentFriendshipRequests()).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })

      it('should reject with the specific error', () => {
        return expect(result.getSentFriendshipRequests()).rejects.toThrow(SocialClientInternalServerError)
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          requests: {
            requests: [
              {
                friend: {
                  address: targetAddress,
                  name: 'User1',
                  hasClaimedName: true,
                  profilePictureUrl: 'https://example.com/profile.jpg'
                },
                message: 'Hello',
                createdAt: 123456789,
                id: '1'
              }
            ]
          },
          paginationData: { page: 0, total: 1 }
        }
        getSentFriendshipRequests.mockResolvedValueOnce(response)
      })

      it('should return the sent requests', async () => {
        await expect(result.getSentFriendshipRequests()).resolves.toEqual(response)
        expect(getSentFriendshipRequests).toHaveBeenCalledWith(GetFriendshipRequestsPayload.create({ pagination: undefined }))
      })
    })
  })

  describe('when getting friendship status', () => {
    let response: GetFriendshipStatusResponse

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        getFriendshipStatus.mockResolvedValueOnce(response)
      })

      it('should reject throwing the received message', () => {
        return expect(result.getFriendshipStatus(targetAddress)).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })

      it('should reject throwing the specific error', () => {
        return expect(result.getFriendshipStatus(targetAddress)).rejects.toThrow(SocialClientInternalServerError)
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          accepted: {
            status: 1,
            message: 'Friends'
          }
        }
        getFriendshipStatus.mockResolvedValueOnce(response)
      })

      it('should return the friendship status', async () => {
        await expect(result.getFriendshipStatus(targetAddress)).resolves.toEqual(response.accepted)
        expect(getFriendshipStatus).toHaveBeenCalledWith(
          GetFriendshipStatusPayload.create({ user: User.create({ address: targetAddress }) })
        )
      })
    })
  })

  describe('when getting mutual friends', () => {
    let response: PaginatedFriendsProfilesResponse

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          friends: [
            {
              address: '0x2',
              name: 'User2',
              hasClaimedName: true,
              profilePictureUrl: 'https://example.com/profile2.jpg'
            }
          ],
          paginationData: { page: 0, total: 1 }
        }
        getMutualFriends.mockResolvedValueOnce(response)
      })

      it('should return the mutual friends', async () => {
        await expect(result.getMutualFriends(targetAddress)).resolves.toEqual(response)
        expect(getMutualFriends).toHaveBeenCalledWith(GetMutualFriendsPayload.create({ user: User.create({ address: targetAddress }) }))
      })
    })
  })

  describe('when requesting friendship', () => {
    let response: UpsertFriendshipResponse

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        upsertFriendship.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.requestFriendship(targetAddress)).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })

      it('should reject with the specific error', () => {
        return expect(result.requestFriendship(targetAddress)).rejects.toThrow(SocialClientInternalServerError)
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          accepted: {
            id: '1',
            createdAt: 123456789,
            friend: {
              address: targetAddress,
              name: 'User1',
              hasClaimedName: true,
              profilePictureUrl: 'https://example.com/profile.jpg'
            }
          }
        }
        upsertFriendship.mockResolvedValueOnce(response)
      })

      it('should return the friendship status', async () => {
        await expect(result.requestFriendship(targetAddress)).resolves.toEqual(response.accepted)
        expect(upsertFriendship).toHaveBeenCalledWith(
          UpsertFriendshipPayload.create({ request: { user: User.create({ address: targetAddress }), message: undefined } })
        )
      })
    })
  })

  describe('when accepting friendship request', () => {
    let response: UpsertFriendshipResponse

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        upsertFriendship.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.acceptFriendshipRequest(targetAddress)).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })

      it('should reject with the specific error', () => {
        return expect(result.acceptFriendshipRequest(targetAddress)).rejects.toThrow(SocialClientInternalServerError)
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          accepted: {
            id: '1',
            createdAt: 123456789,
            friend: {
              address: targetAddress,
              name: 'User1',
              hasClaimedName: true,
              profilePictureUrl: 'https://example.com/profile.jpg'
            }
          }
        }
        upsertFriendship.mockResolvedValueOnce(response)
      })

      it('should return the friendship status', async () => {
        await expect(result.acceptFriendshipRequest(targetAddress)).resolves.toEqual(response.accepted)
        expect(upsertFriendship).toHaveBeenCalledWith(
          UpsertFriendshipPayload.create({ accept: { user: User.create({ address: targetAddress }) } })
        )
      })
    })
  })

  describe('when rejecting friendship request', () => {
    let response: UpsertFriendshipResponse

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        upsertFriendship.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.rejectFriendshipRequest(targetAddress)).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })

      it('should reject with the specific error', () => {
        return expect(result.rejectFriendshipRequest(targetAddress)).rejects.toThrow(SocialClientInternalServerError)
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          accepted: {
            id: '1',
            createdAt: 123456789,
            friend: {
              address: targetAddress,
              name: 'User1',
              hasClaimedName: true,
              profilePictureUrl: 'https://example.com/profile.jpg'
            },
            message: 'A message'
          }
        }
        upsertFriendship.mockResolvedValueOnce(response)
      })

      it('should return the friendship status', async () => {
        await expect(result.rejectFriendshipRequest(targetAddress)).resolves.toEqual(response.accepted)
        expect(upsertFriendship).toHaveBeenCalledWith(
          UpsertFriendshipPayload.create({ reject: { user: User.create({ address: targetAddress }) } })
        )
      })
    })
  })

  describe('when cancelling friendship request', () => {
    let response: UpsertFriendshipResponse

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        upsertFriendship.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.cancelFriendshipRequest(targetAddress)).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })

      it('should reject with the specific error', () => {
        return expect(result.cancelFriendshipRequest(targetAddress)).rejects.toThrow(SocialClientInternalServerError)
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          accepted: {
            id: '1',
            createdAt: 123456789,
            friend: {
              address: targetAddress,
              name: 'User1',
              hasClaimedName: true,
              profilePictureUrl: 'https://example.com/profile.jpg'
            },
            message: 'A message'
          }
        }
        upsertFriendship.mockResolvedValueOnce(response)
      })

      it('should return the friendship status', async () => {
        await expect(result.cancelFriendshipRequest(targetAddress)).resolves.toEqual(response.accepted)
        expect(upsertFriendship).toHaveBeenCalledWith(
          UpsertFriendshipPayload.create({ cancel: { user: User.create({ address: targetAddress }) } })
        )
      })
    })
  })

  describe('when deleting friendship request', () => {
    let response: UpsertFriendshipResponse

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        upsertFriendship.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.deleteFriendshipRequest(targetAddress)).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })

      it('should reject with the specific error', () => {
        return expect(result.deleteFriendshipRequest(targetAddress)).rejects.toThrow(SocialClientInternalServerError)
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          accepted: {
            id: '1',
            createdAt: 123456789,
            friend: {
              address: targetAddress,
              name: 'User1',
              hasClaimedName: true,
              profilePictureUrl: 'https://example.com/profile.jpg'
            },
            message: 'A message'
          }
        }
        upsertFriendship.mockResolvedValueOnce(response)
      })

      it('should return the friendship status', async () => {
        await expect(result.deleteFriendshipRequest(targetAddress)).resolves.toEqual(response.accepted)
        expect(upsertFriendship).toHaveBeenCalledWith(
          UpsertFriendshipPayload.create({ delete: { user: User.create({ address: targetAddress }) } })
        )
      })
    })
  })

  describe('when subscribing to friend connectivity updates', () => {
    describe('and the server returns updates', () => {
      beforeEach(() => {
        subscribeToFriendConnectivityUpdates.mockImplementationOnce(async function* () {
          yield {
            friend: {
              address: targetAddress,
              name: 'User1',
              hasClaimedName: true,
              profilePictureUrl: 'https://example.com/profile.jpg'
            },
            status: 1
          }
          yield {
            friend: {
              address: '0x2',
              name: 'User2',
              hasClaimedName: true,
              profilePictureUrl: 'https://example.com/profile2.jpg'
            },
            status: 0
          }
        })
      })

      it('should yield the connectivity updates', async () => {
        const generator = result.subscribeToFriendConnectivityUpdates()

        await expect(generator.next()).resolves.toEqual({
          done: false,
          value: {
            friend: {
              address: targetAddress,
              name: 'User1',
              hasClaimedName: true,
              profilePictureUrl: 'https://example.com/profile.jpg'
            },
            status: 1
          }
        })

        await expect(generator.next()).resolves.toEqual({
          done: false,
          value: {
            friend: {
              address: '0x2',
              name: 'User2',
              hasClaimedName: true,
              profilePictureUrl: 'https://example.com/profile2.jpg'
            },
            status: 0
          }
        })

        await expect(generator.next()).resolves.toEqual({ done: true, value: undefined })
      })
    })
  })

  describe('when getting social settings', () => {
    let response: GetSocialSettingsResponse

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        getSocialSettings.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.getSocialSettings()).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })

      it('should reject with the specific error', () => {
        return expect(result.getSocialSettings()).rejects.toThrow(SocialClientInternalServerError)
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          ok: {
            settings: {
              privateMessagesPrivacy: 1,
              blockedUsersMessagesVisibility: 1
            }
          }
        }
        getSocialSettings.mockResolvedValueOnce(response)
      })

      it('should return the social settings', async () => {
        await expect(result.getSocialSettings()).resolves.toEqual(response)
        expect(getSocialSettings).toHaveBeenCalledWith(Empty.create())
      })
    })
  })

  describe('when upserting social settings', () => {
    let response: UpsertSocialSettingsResponse
    let settings: { privateMessagesPrivacy: number }

    beforeEach(() => {
      settings = { privateMessagesPrivacy: 1 }
    })

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        upsertSocialSettings.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.upsertSocialSettings(settings)).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })

      it('should reject with the specific error', () => {
        return expect(result.upsertSocialSettings(settings)).rejects.toThrow(SocialClientInternalServerError)
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          ok: {
            privateMessagesPrivacy: 1,
            blockedUsersMessagesVisibility: 1
          }
        }
        upsertSocialSettings.mockResolvedValueOnce(response)
      })

      it('should return the updated settings', async () => {
        await expect(result.upsertSocialSettings(settings)).resolves.toEqual(response)
        expect(upsertSocialSettings).toHaveBeenCalledWith(UpsertSocialSettingsPayload.create(settings))
      })
    })
  })

  describe('when getting private messages settings', () => {
    let response: GetPrivateMessagesSettingsResponse
    let addresses: string[]

    beforeEach(() => {
      addresses = [targetAddress, '0x2']
    })

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        getPrivateMessagesSettings.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.getPrivateMessagesSettings(addresses)).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })

      it('should reject with the specific error', () => {
        return expect(result.getPrivateMessagesSettings(addresses)).rejects.toThrow(SocialClientInternalServerError)
      })
    })

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          ok: {
            settings: [
              { user: { address: targetAddress }, privateMessagesPrivacy: 1, isFriend: true },
              { user: { address: '0x2' }, privateMessagesPrivacy: 0, isFriend: true }
            ]
          }
        }
        getPrivateMessagesSettings.mockResolvedValueOnce(response)
      })

      it('should return the private messages settings', async () => {
        await expect(result.getPrivateMessagesSettings(addresses)).resolves.toEqual(response)
        expect(getPrivateMessagesSettings).toHaveBeenCalledWith(
          GetPrivateMessagesSettingsPayload.create({
            user: addresses.map(address => User.create({ address }))
          })
        )
      })
    })
  })

  describe('when getting blocking status', () => {
    let response: GetBlockingStatusResponse

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          blockedUsers: [targetAddress],
          blockedByUsers: ['0x2']
        }
        getBlockingStatus.mockResolvedValueOnce(response)
      })

      it('should return the blocking status', async () => {
        await expect(result.getBlockingStatus()).resolves.toEqual(response)
        expect(getBlockingStatus).toHaveBeenCalledWith(Empty.create())
      })
    })
  })

  describe('when getting blocked users', () => {
    let response: GetBlockedUsersResponse

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          profiles: [
            {
              address: targetAddress,
              name: 'Blocked User',
              hasClaimedName: false,
              profilePictureUrl: 'https://example.com/blocked.jpg'
            }
          ],
          paginationData: { page: 0, total: 1 }
        }
        getBlockedUsers.mockResolvedValueOnce(response)
      })

      it('should return the blocked users', async () => {
        await expect(result.getBlockedUsers()).resolves.toEqual(response)
        expect(getBlockedUsers).toHaveBeenCalledWith(GetBlockedUsersPayload.create({ pagination: undefined }))
      })
    })
  })

  describe('when blocking a user', () => {
    let response: BlockUserResponse

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          ok: {
            profile: {
              address: targetAddress,
              name: 'Blocked User',
              hasClaimedName: false,
              profilePictureUrl: 'https://example.com/blocked.jpg'
            }
          }
        }
        blockUser.mockResolvedValueOnce(response)
      })

      it('should return the block result', async () => {
        await expect(result.blockUser(targetAddress)).resolves.toEqual(response)
        expect(blockUser).toHaveBeenCalledWith(BlockUserPayload.create({ user: User.create({ address: targetAddress }) }))
      })
    })
  })

  describe('when unblocking a user', () => {
    let response: UnblockUserResponse

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          ok: {
            profile: {
              address: targetAddress,
              name: 'Unblocked User',
              hasClaimedName: false,
              profilePictureUrl: 'https://example.com/unblocked.jpg'
            }
          }
        }
        unblockUser.mockResolvedValueOnce(response)
      })

      it('should return the unblock result', async () => {
        await expect(result.unblockUser(targetAddress)).resolves.toEqual(response)
        expect(unblockUser).toHaveBeenCalledWith(UnblockUserPayload.create({ user: User.create({ address: targetAddress }) }))
      })
    })
  })
})
