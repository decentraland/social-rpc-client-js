import { Wallet } from 'ethers'
import { Authenticator } from '@dcl/crypto'
import type { RpcClient, RpcClientPort, Transport } from '@dcl/rpc'
import { createRpcClient } from '@dcl/rpc/dist/client'
import { loadService } from '@dcl/rpc/dist/codegen'
import { AuthIdentity } from 'decentraland-crypto-fetch'
import { createSocialClientV2 } from '../src/client-v2'
import { SocialClientInternalServerError } from '../src/errors'
import {
  AcceptPrivateVoiceChatPayload,
  AcceptPrivateVoiceChatResponse,
  BlockUserPayload,
  BlockUserResponse,
  EndPrivateVoiceChatPayload,
  EndPrivateVoiceChatResponse,
  GetBlockedUsersPayload,
  GetBlockedUsersResponse,
  GetBlockingStatusResponse,
  GetFriendshipRequestsPayload,
  GetFriendshipStatusPayload,
  GetFriendshipStatusResponse,
  GetFriendsPayload,
  GetIncomingPrivateVoiceChatRequestResponse,
  GetMutualFriendsPayload,
  GetPrivateMessagesSettingsPayload,
  GetPrivateMessagesSettingsResponse,
  GetSocialSettingsResponse,
  PaginatedFriendshipRequestsResponse,
  PaginatedFriendsProfilesResponse,
  RejectPrivateVoiceChatPayload,
  RejectPrivateVoiceChatResponse,
  SocialServiceDefinition,
  StartPrivateVoiceChatPayload,
  StartPrivateVoiceChatResponse,
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

describe('when creating a new client v2', () => {
  let createRpcClientMock: jest.MockedFunction<typeof createRpcClient>
  let createWebSocketsTransportMock: jest.MockedFunction<typeof createWebSocketsTransport>
  let loadServiceMock: jest.MockedFunction<typeof loadService>
  let socialClientRpcUrl: string
  let identity: AuthIdentity
  let transport: Transport & { connect: () => void; sendMessage: jest.Mock; on: jest.Mock; close: jest.Mock }
  let rpcClient: RpcClient
  let port: RpcClientPort
  let portCloseMock: jest.MockedFunction<RpcClientPort['close']>
  let loadServiceResult: jest.Mocked<ReturnType<typeof loadService<object, SocialServiceDefinition>>>
  let result: ReturnType<typeof createSocialClientV2>
  let targetAddress: string

  beforeEach(async () => {
    createRpcClientMock = jest.mocked(createRpcClient)
    createWebSocketsTransportMock = jest.mocked(createWebSocketsTransport)
    loadServiceMock = jest.mocked(loadService)

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
    portCloseMock = jest.fn()
    port = { close: portCloseMock } as unknown as RpcClientPort
    rpcClient = { createPort: jest.fn().mockResolvedValue(port) } as RpcClient

    // Set up the loadService result
    loadServiceResult = {
      getFriends: jest.fn(),
      getPendingFriendshipRequests: jest.fn(),
      getSentFriendshipRequests: jest.fn(),
      getFriendshipStatus: jest.fn(),
      getMutualFriends: jest.fn(),
      upsertFriendship: jest.fn(),
      subscribeToFriendConnectivityUpdates: jest.fn(),
      subscribeToFriendshipUpdates: jest.fn(),
      getSocialSettings: jest.fn(),
      upsertSocialSettings: jest.fn(),
      getPrivateMessagesSettings: jest.fn(),
      subscribeToBlockUpdates: jest.fn(),
      getBlockingStatus: jest.fn(),
      getBlockedUsers: jest.fn(),
      blockUser: jest.fn(),
      unblockUser: jest.fn(),
      startPrivateVoiceChat: jest.fn(),
      rejectPrivateVoiceChat: jest.fn(),
      acceptPrivateVoiceChat: jest.fn(),
      endPrivateVoiceChat: jest.fn(),
      getIncomingPrivateVoiceChatRequest: jest.fn(),
      subscribeToPrivateVoiceChatUpdates: jest.fn()
    }

    // Set up mocks
    createWebSocketsTransportMock.mockReturnValueOnce(transport)
    createRpcClientMock.mockResolvedValueOnce(rpcClient)
    loadServiceMock.mockReturnValueOnce(loadServiceResult as unknown as ReturnType<typeof loadService<object, SocialServiceDefinition>>)

    // Simulate the connect event and callback invocation
    transport.on.mockImplementation((event, callback) => {
      if (event === 'connect') {
        setTimeout(() => callback(), 0)
      }
      return transport
    })

    // Create the client
    result = createSocialClientV2(socialClientRpcUrl)
    await result.connect(identity)
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
      expect(portCloseMock).toHaveBeenCalled()
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
        loadServiceResult.getFriends.mockResolvedValueOnce(response)
      })

      it('should return the friends', async () => {
        await expect(result.getFriends()).resolves.toEqual(response)
        expect(loadServiceResult.getFriends).toHaveBeenCalledWith(GetFriendsPayload.create({ pagination: undefined }))
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
        loadServiceResult.getPendingFriendshipRequests.mockResolvedValueOnce(response)
      })

      it('should return the pending requests', async () => {
        await expect(result.getPendingFriendshipRequests()).resolves.toEqual({
          requests: response.requests?.requests,
          paginationData: response.paginationData
        })
        expect(loadServiceResult.getPendingFriendshipRequests).toHaveBeenCalledWith(
          GetFriendshipRequestsPayload.create({ pagination: undefined })
        )
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
        loadServiceResult.getSentFriendshipRequests.mockResolvedValueOnce(response)
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
        loadServiceResult.getSentFriendshipRequests.mockResolvedValueOnce(response)
      })

      it('should return the sent requests', async () => {
        await expect(result.getSentFriendshipRequests()).resolves.toEqual({
          requests: response.requests?.requests,
          paginationData: response.paginationData
        })
        expect(loadServiceResult.getSentFriendshipRequests).toHaveBeenCalledWith(
          GetFriendshipRequestsPayload.create({ pagination: undefined })
        )
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
        loadServiceResult.getFriendshipStatus.mockResolvedValueOnce(response)
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
        loadServiceResult.getFriendshipStatus.mockResolvedValueOnce(response)
      })

      it('should return the friendship status', async () => {
        await expect(result.getFriendshipStatus(targetAddress)).resolves.toEqual(response.accepted)
        expect(loadServiceResult.getFriendshipStatus).toHaveBeenCalledWith(
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
        loadServiceResult.getMutualFriends.mockResolvedValueOnce(response)
      })

      it('should return the mutual friends', async () => {
        await expect(result.getMutualFriends(targetAddress)).resolves.toEqual(response)
        expect(loadServiceResult.getMutualFriends).toHaveBeenCalledWith(
          GetMutualFriendsPayload.create({ user: User.create({ address: targetAddress }) })
        )
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
        loadServiceResult.upsertFriendship.mockResolvedValueOnce(response)
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
        loadServiceResult.upsertFriendship.mockResolvedValueOnce(response)
      })

      it('should return the friendship status', async () => {
        await expect(result.requestFriendship(targetAddress)).resolves.toEqual(response.accepted)
        expect(loadServiceResult.upsertFriendship).toHaveBeenCalledWith(
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
        loadServiceResult.upsertFriendship.mockResolvedValueOnce(response)
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
        loadServiceResult.upsertFriendship.mockResolvedValueOnce(response)
      })

      it('should return the friendship status', async () => {
        await expect(result.acceptFriendshipRequest(targetAddress)).resolves.toEqual(response.accepted)
        expect(loadServiceResult.upsertFriendship).toHaveBeenCalledWith(
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
        loadServiceResult.upsertFriendship.mockResolvedValueOnce(response)
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
        loadServiceResult.upsertFriendship.mockResolvedValueOnce(response)
      })

      it('should return the friendship status', async () => {
        await expect(result.rejectFriendshipRequest(targetAddress)).resolves.toEqual(response.accepted)
        expect(loadServiceResult.upsertFriendship).toHaveBeenCalledWith(
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
        loadServiceResult.upsertFriendship.mockResolvedValueOnce(response)
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
        loadServiceResult.upsertFriendship.mockResolvedValueOnce(response)
      })

      it('should return the friendship status', async () => {
        await expect(result.cancelFriendshipRequest(targetAddress)).resolves.toEqual(response.accepted)
        expect(loadServiceResult.upsertFriendship).toHaveBeenCalledWith(
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
        loadServiceResult.upsertFriendship.mockResolvedValueOnce(response)
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
        loadServiceResult.upsertFriendship.mockResolvedValueOnce(response)
      })

      it('should return the friendship status', async () => {
        await expect(result.deleteFriendshipRequest(targetAddress)).resolves.toEqual(response.accepted)
        expect(loadServiceResult.upsertFriendship).toHaveBeenCalledWith(
          UpsertFriendshipPayload.create({ delete: { user: User.create({ address: targetAddress }) } })
        )
      })
    })
  })

  describe('when subscribing to friend connectivity updates', () => {
    describe('and the server returns updates', () => {
      beforeEach(() => {
        loadServiceResult.subscribeToFriendConnectivityUpdates.mockImplementationOnce(async function* () {
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
        loadServiceResult.getSocialSettings.mockResolvedValueOnce(response)
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
        loadServiceResult.getSocialSettings.mockResolvedValueOnce(response)
      })

      it('should return the social settings', async () => {
        await expect(result.getSocialSettings()).resolves.toEqual(response.ok)
        expect(loadServiceResult.getSocialSettings).toHaveBeenCalledWith(Empty.create())
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
        loadServiceResult.upsertSocialSettings.mockResolvedValueOnce(response)
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
        loadServiceResult.upsertSocialSettings.mockResolvedValueOnce(response)
      })

      it('should return the updated settings', async () => {
        await expect(result.upsertSocialSettings(settings)).resolves.toEqual(response.ok)
        expect(loadServiceResult.upsertSocialSettings).toHaveBeenCalledWith(UpsertSocialSettingsPayload.create(settings))
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
        loadServiceResult.getPrivateMessagesSettings.mockResolvedValueOnce(response)
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
        loadServiceResult.getPrivateMessagesSettings.mockResolvedValueOnce(response)
      })

      it('should return the private messages settings', async () => {
        await expect(result.getPrivateMessagesSettings(addresses)).resolves.toEqual(response.ok)
        expect(loadServiceResult.getPrivateMessagesSettings).toHaveBeenCalledWith(
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
        loadServiceResult.getBlockingStatus.mockResolvedValueOnce(response)
      })

      it('should return the blocking status', async () => {
        await expect(result.getBlockingStatus()).resolves.toEqual(response)
        expect(loadServiceResult.getBlockingStatus).toHaveBeenCalledWith(Empty.create())
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
        loadServiceResult.getBlockedUsers.mockResolvedValueOnce(response)
      })

      it('should return the blocked users', async () => {
        await expect(result.getBlockedUsers()).resolves.toEqual(response)
        expect(loadServiceResult.getBlockedUsers).toHaveBeenCalledWith(GetBlockedUsersPayload.create({ pagination: undefined }))
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
        loadServiceResult.blockUser.mockResolvedValueOnce(response)
      })

      it('should return the block result', async () => {
        await expect(result.blockUser(targetAddress)).resolves.toEqual(response.ok)
        expect(loadServiceResult.blockUser).toHaveBeenCalledWith(BlockUserPayload.create({ user: User.create({ address: targetAddress }) }))
      })
    })

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        loadServiceResult.blockUser.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.blockUser(targetAddress)).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
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
        loadServiceResult.unblockUser.mockResolvedValueOnce(response)
      })

      it('should return the unblock result', async () => {
        await expect(result.unblockUser(targetAddress)).resolves.toEqual(response.ok)
        expect(loadServiceResult.unblockUser).toHaveBeenCalledWith(
          UnblockUserPayload.create({ user: User.create({ address: targetAddress }) })
        )
      })
    })

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        loadServiceResult.unblockUser.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.unblockUser(targetAddress)).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })
    })
  })

  describe('when starting a private voice chat', () => {
    let response: StartPrivateVoiceChatResponse

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          ok: {
            callId: '123'
          }
        }
        loadServiceResult.startPrivateVoiceChat.mockResolvedValueOnce(response)
      })

      it('should resolve with the voice chat result', async () => {
        await expect(result.startPrivateVoiceChat(targetAddress)).resolves.toEqual(response.ok)
        expect(loadServiceResult.startPrivateVoiceChat).toHaveBeenCalledWith(
          StartPrivateVoiceChatPayload.create({ callee: User.create({ address: targetAddress }) })
        )
      })
    })

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        loadServiceResult.startPrivateVoiceChat.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.startPrivateVoiceChat(targetAddress)).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })
    })
  })

  describe('when rejecting a private voice chat', () => {
    let response: RejectPrivateVoiceChatResponse

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          ok: {
            callId: '123'
          }
        }
        loadServiceResult.rejectPrivateVoiceChat.mockResolvedValueOnce(response)
      })

      it('should resolve with the voice chat result', async () => {
        await expect(result.rejectPrivateVoiceChat('123')).resolves.toEqual(response.ok)
        expect(loadServiceResult.rejectPrivateVoiceChat).toHaveBeenCalledWith(RejectPrivateVoiceChatPayload.create({ callId: '123' }))
      })
    })

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        loadServiceResult.rejectPrivateVoiceChat.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.rejectPrivateVoiceChat('123')).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })
    })
  })

  describe('when accepting a private voice chat', () => {
    let response: AcceptPrivateVoiceChatResponse

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          ok: {
            callId: '123',
            credentials: {
              connectionUrl: 'a-connection-url'
            }
          }
        }
        loadServiceResult.acceptPrivateVoiceChat.mockResolvedValueOnce(response)
      })

      it('should resolve with the voice chat result', async () => {
        await expect(result.acceptPrivateVoiceChat('123')).resolves.toEqual(response.ok)
        expect(loadServiceResult.acceptPrivateVoiceChat).toHaveBeenCalledWith(AcceptPrivateVoiceChatPayload.create({ callId: '123' }))
      })
    })

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        loadServiceResult.acceptPrivateVoiceChat.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.acceptPrivateVoiceChat('123')).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })
    })
  })

  describe('when ending a private voice chat', () => {
    let response: EndPrivateVoiceChatResponse

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          ok: {
            callId: '123'
          }
        }
        loadServiceResult.endPrivateVoiceChat.mockResolvedValueOnce(response)
      })

      it('should resolve with the voice chat result', async () => {
        await expect(result.endPrivateVoiceChat('123')).resolves.toEqual(response.ok)
        expect(loadServiceResult.endPrivateVoiceChat).toHaveBeenCalledWith(EndPrivateVoiceChatPayload.create({ callId: '123' }))
      })
    })

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        loadServiceResult.endPrivateVoiceChat.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.endPrivateVoiceChat('123')).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })
    })
  })

  describe('when getting incoming private voice chat requests', () => {
    let response: GetIncomingPrivateVoiceChatRequestResponse

    describe('and the server returns successfully', () => {
      beforeEach(() => {
        response = {
          ok: {
            callId: '123',
            caller: User.create({ address: targetAddress })
          }
        }
        loadServiceResult.getIncomingPrivateVoiceChatRequest.mockResolvedValueOnce(response)
      })

      it('should resolve with the voice chat result', async () => {
        await expect(result.getIncomingPrivateVoiceChatRequests()).resolves.toEqual(response.ok)
        expect(loadServiceResult.getIncomingPrivateVoiceChatRequest).toHaveBeenCalledWith(Empty.create())
      })
    })

    describe('and the server returns an error', () => {
      beforeEach(() => {
        response = {
          internalServerError: { message: 'anErrorOccurred' }
        }
        loadServiceResult.getIncomingPrivateVoiceChatRequest.mockResolvedValueOnce(response)
      })

      it('should reject with the error', () => {
        return expect(result.getIncomingPrivateVoiceChatRequests()).rejects.toThrow(
          new SocialClientInternalServerError(response.internalServerError?.message ?? '')
        )
      })
    })
  })
})
