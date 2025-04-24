import { createRpcClient } from '@dcl/rpc/dist/client'
import { loadService } from '@dcl/rpc/dist/codegen'
import { RawClient, FromTsProtoServiceDefinition } from '@dcl/rpc/dist/codegen-types'
import { AuthIdentity, signedHeaderFactory } from 'decentraland-crypto-fetch'
import { processErrors } from './errors'
import {
  BlockUserPayload,
  BlockUserResponse,
  FriendConnectivityUpdate,
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
  Pagination,
  SocialServiceDefinition,
  SocialSettings,
  UnblockUserPayload,
  UnblockUserResponse,
  UpsertFriendshipPayload,
  UpsertFriendshipResponse,
  UpsertSocialSettingsPayload,
  UpsertSocialSettingsResponse,
  User
} from './protobuff-types/decentraland/social_service/v2/social_service_v2.gen'
import { Empty } from './protobuff-types/google/protobuf/empty.gen'
import { createWebSocketsTransport } from './transport'

const signHeader = signedHeaderFactory()

export async function createSocialClientV2(socialClientRpcUrl: string, identity: AuthIdentity) {
  let service: RawClient<FromTsProtoServiceDefinition<SocialServiceDefinition>>
  const webSocketsTransport = createWebSocketsTransport(socialClientRpcUrl)
  return {
    connect: async () => {
      // Create the authorization headers
      const signedHeaders = signHeader(identity, 'GET', '/', {})
      const signedHeadersEntries: Record<string, string> = {}
      signedHeaders.forEach((value: string, key: string) => {
        signedHeadersEntries[key] = value
      })
      const promiseOfAuthorization = new Promise((resolve, reject) => {
        try {
          webSocketsTransport.on('connect', () => {
            // Connect to the social client and authenticate
            webSocketsTransport.sendMessage(new TextEncoder().encode(JSON.stringify(signedHeadersEntries)))
            resolve(undefined)
          })
        } catch (error) {
          reject(error)
        }
      })

      webSocketsTransport.connect()
      const rpcClient = await createRpcClient(webSocketsTransport)
      const port = await rpcClient.createPort('social')
      await promiseOfAuthorization
      service = loadService(port, SocialServiceDefinition)
    },
    onDisconnect: (callback: () => unknown) => {
      webSocketsTransport.on('close', () => {
        callback()
      })
    },
    onConnectionError: (callback: (error: Error) => unknown) => {
      webSocketsTransport.on('error', (error: Error) => {
        callback(error)
      })
    },
    disconnect: () => {
      webSocketsTransport.close()
    },
    onTransportError: (error: Error) => {
      console.error('Transport error', error)
    },
    getFriends: async function (pagination?: Pagination): Promise<PaginatedFriendsProfilesResponse> {
      // TODO: The protocol should return errors in case of failure
      return service.getFriends(GetFriendsPayload.create({ pagination }))
    },
    getPendingFriendshipRequests: async function (pagination?: Pagination): Promise<PaginatedFriendshipRequestsResponse> {
      return service.getPendingFriendshipRequests(GetFriendshipRequestsPayload.create({ pagination }))
    },
    getSentFriendshipRequests: async function (pagination?: Pagination): Promise<PaginatedFriendshipRequestsResponse> {
      const response = await service.getSentFriendshipRequests(GetFriendshipRequestsPayload.create({ pagination }))
      processErrors(response)
      return response
    },
    // TODO: Make it return the status as non undefined
    getFriendshipStatus: async function (address: string): Promise<Required<GetFriendshipStatusResponse['accepted']>> {
      const response = await service.getFriendshipStatus(GetFriendshipStatusPayload.create({ user: User.create({ address }) }))
      processErrors(response)

      if (!response.accepted) {
        throw new Error('Friendship status has an incomplete response')
      }

      return response.accepted as Required<GetFriendshipStatusResponse['accepted']>
    },
    getMutualFriends: async function (address: string): Promise<PaginatedFriendsProfilesResponse> {
      // TODO: The protocol should return errors in case of failure
      return service.getMutualFriends(GetMutualFriendsPayload.create({ user: User.create({ address }) }))
    },
    // TODO: Make it return the status as non undefined
    requestFriendship: async function (address: string, message?: string): Promise<Required<UpsertFriendshipResponse['accepted']>> {
      const response = await service.upsertFriendship(
        UpsertFriendshipPayload.create({ request: { user: User.create({ address }), message } })
      )
      processErrors(response)

      if (!response.accepted) {
        throw new Error('Friendship request has an incomplete response')
      }

      return response.accepted as Required<UpsertFriendshipResponse['accepted']>
    },
    // TODO: Make it return the status as non undefined
    acceptFriendshipRequest: async function (address: string): Promise<Required<UpsertFriendshipResponse['accepted']>> {
      const response = await service.upsertFriendship(UpsertFriendshipPayload.create({ accept: { user: User.create({ address }) } }))
      processErrors(response)

      if (!response.accepted) {
        throw new Error('Friendship request has an incomplete response')
      }

      return response.accepted as Required<UpsertFriendshipResponse['accepted']>
    },
    // TODO: Make it return the status as non undefined
    rejectFriendshipRequest: async function (address: string): Promise<Required<UpsertFriendshipResponse['accepted']>> {
      const response = await service.upsertFriendship(UpsertFriendshipPayload.create({ reject: { user: User.create({ address }) } }))
      processErrors(response)

      if (!response.accepted) {
        throw new Error('Friendship request has an incomplete response')
      }

      return response.accepted as Required<UpsertFriendshipResponse['accepted']>
    },
    deleteFriendshipRequest: async function (address: string): Promise<Required<UpsertFriendshipResponse['accepted']>> {
      const response = await service.upsertFriendship(UpsertFriendshipPayload.create({ delete: { user: User.create({ address }) } }))
      processErrors(response)

      if (!response.accepted) {
        throw new Error('Friendship request has an incomplete response')
      }

      return response.accepted as Required<UpsertFriendshipResponse['accepted']>
    },
    cancelFriendshipRequest: async function (address: string): Promise<Required<UpsertFriendshipResponse['accepted']>> {
      const response = await service.upsertFriendship(UpsertFriendshipPayload.create({ cancel: { user: User.create({ address }) } }))
      processErrors(response)

      if (!response.accepted) {
        throw new Error('Friendship request has an incomplete response')
      }

      return response.accepted as Required<UpsertFriendshipResponse['accepted']>
    },
    subscribeToFriendConnectivityUpdates: async function* (): AsyncGenerator<FriendConnectivityUpdate, void, unknown> {
      const response = service.subscribeToFriendConnectivityUpdates(Empty.create())
      for await (const friendConnectivityUpdate of response) {
        // TODO: The protocol should return errors in case of failure
        yield friendConnectivityUpdate
      }
    },
    subscribeToFriendshipUpdates: async function* () {
      const response = service.subscribeToFriendshipUpdates(Empty.create())
      for await (const friendshipUpdate of response) {
        // TODO: The protocol should return errors in case of failure
        yield friendshipUpdate
      }
    },
    getSocialSettings: async function (): Promise<GetSocialSettingsResponse> {
      const response = await service.getSocialSettings(Empty.create())
      processErrors(response)
      return response
    },
    upsertSocialSettings: async function (settings: Partial<SocialSettings>): Promise<UpsertSocialSettingsResponse> {
      const response = await service.upsertSocialSettings(UpsertSocialSettingsPayload.create(settings))
      processErrors(response)
      return response
    },
    getPrivateMessagesSettings: async function (addresses: string[]): Promise<GetPrivateMessagesSettingsResponse> {
      const response = await service.getPrivateMessagesSettings(
        GetPrivateMessagesSettingsPayload.create({ user: addresses.map(address => User.create({ address })) })
      )
      processErrors(response)
      return response
    },
    subscribeToBlockUpdates: async function* () {
      const response = service.subscribeToBlockUpdates(Empty.create())
      for await (const blockUpdate of response) {
        // TODO: The protocol should return errors in case of failure
        yield blockUpdate
      }
    },
    getBlockingStatus: async function (): Promise<GetBlockingStatusResponse> {
      return service.getBlockingStatus(Empty.create())
    },
    getBlockedUsers: async function (pagination?: Pagination): Promise<GetBlockedUsersResponse> {
      return service.getBlockedUsers(GetBlockedUsersPayload.create({ pagination }))
    },
    unblockUser: async function (address: string): Promise<UnblockUserResponse> {
      return service.unblockUser(UnblockUserPayload.create({ user: User.create({ address }) }))
    },
    blockUser: async function (address: string): Promise<BlockUserResponse> {
      return service.blockUser(BlockUserPayload.create({ user: User.create({ address }) }))
    }
  }
}
