import { RpcClientPort } from '@dcl/rpc'
import { createRpcClient } from '@dcl/rpc/dist/client'
import { loadService } from '@dcl/rpc/dist/codegen'
import { RawClient, FromTsProtoServiceDefinition } from '@dcl/rpc/dist/codegen-types'
import { AuthIdentity, signedHeaderFactory } from 'decentraland-crypto-fetch'
import { hasOkResponse, processErrors, SocialClientIncompleteResponseError } from './errors'
import {
  AcceptPrivateVoiceChatPayload,
  AcceptPrivateVoiceChatResponse,
  BlockUserPayload,
  BlockUserResponse,
  EndPrivateVoiceChatPayload,
  EndPrivateVoiceChatResponse,
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
  GetIncomingPrivateVoiceChatRequestResponse,
  PaginatedFriendshipRequestsResponse,
  PaginatedFriendsProfilesResponse,
  Pagination,
  RejectPrivateVoiceChatPayload,
  RejectPrivateVoiceChatResponse,
  SocialServiceDefinition,
  SocialSettings,
  StartPrivateVoiceChatPayload,
  StartPrivateVoiceChatResponse,
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

export function createSocialClientV2(socialClientRpcUrl: string) {
  let service: RawClient<FromTsProtoServiceDefinition<SocialServiceDefinition>>
  const webSocketsTransport = createWebSocketsTransport(socialClientRpcUrl)
  let port: RpcClientPort
  return {
    connect: async (identity: AuthIdentity) => {
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
      port = await rpcClient.createPort('social')
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
      if (port) {
        port.close()
      }
      webSocketsTransport.close()
    },
    onTransportError: (error: Error) => {
      console.error('Transport error', error)
    },
    getFriends: async function (pagination?: Pagination): Promise<PaginatedFriendsProfilesResponse> {
      // TODO: The protocol should return errors in case of failure
      return service.getFriends(GetFriendsPayload.create({ pagination }))
    },
    getPendingFriendshipRequests: async function (
      pagination?: Pagination
    ): Promise<
      Required<
        { requests: NonNullable<PaginatedFriendshipRequestsResponse['requests']>['requests'] } & Pick<
          PaginatedFriendshipRequestsResponse,
          'paginationData'
        >
      >
    > {
      const response = await service.getPendingFriendshipRequests(GetFriendshipRequestsPayload.create({ pagination }))
      processErrors(response)
      if (!response.requests?.requests || !response.paginationData) {
        throw new SocialClientIncompleteResponseError()
      }
      return {
        requests: response.requests.requests,
        paginationData: response.paginationData
      }
    },
    getSentFriendshipRequests: async function (
      pagination?: Pagination
    ): Promise<
      Required<
        { requests: NonNullable<PaginatedFriendshipRequestsResponse['requests']>['requests'] } & Pick<
          PaginatedFriendshipRequestsResponse,
          'paginationData'
        >
      >
    > {
      const response = await service.getSentFriendshipRequests(GetFriendshipRequestsPayload.create({ pagination }))
      processErrors(response)
      if (!response.requests?.requests || !response.paginationData) {
        throw new SocialClientIncompleteResponseError()
      }
      return {
        requests: response.requests.requests,
        paginationData: response.paginationData
      }
    },
    // TODO: Make it return the status as non undefined
    getFriendshipStatus: async function (address: string): Promise<NonNullable<GetFriendshipStatusResponse['accepted']>> {
      const response = await service.getFriendshipStatus(GetFriendshipStatusPayload.create({ user: User.create({ address }) }))
      processErrors(response)

      if (!response.accepted) {
        throw new SocialClientIncompleteResponseError()
      }

      return response.accepted
    },
    getMutualFriends: async function (address: string, pagination?: Pagination): Promise<PaginatedFriendsProfilesResponse> {
      // TODO: The protocol should return errors in case of failure
      return service.getMutualFriends(GetMutualFriendsPayload.create({ user: User.create({ address }), pagination }))
    },
    // TODO: Make it return the status as non undefined
    requestFriendship: async function (address: string, message?: string): Promise<NonNullable<UpsertFriendshipResponse['accepted']>> {
      const response = await service.upsertFriendship(
        UpsertFriendshipPayload.create({ request: { user: User.create({ address }), message } })
      )
      processErrors(response)

      if (!response.accepted) {
        throw new SocialClientIncompleteResponseError()
      }

      return response.accepted
    },
    // TODO: Make it return the status as non undefined
    acceptFriendshipRequest: async function (address: string): Promise<NonNullable<UpsertFriendshipResponse['accepted']>> {
      const response = await service.upsertFriendship(UpsertFriendshipPayload.create({ accept: { user: User.create({ address }) } }))
      processErrors(response)

      if (!response.accepted) {
        throw new SocialClientIncompleteResponseError()
      }

      return response.accepted
    },
    // TODO: Make it return the status as non undefined
    rejectFriendshipRequest: async function (address: string): Promise<NonNullable<UpsertFriendshipResponse['accepted']>> {
      const response = await service.upsertFriendship(UpsertFriendshipPayload.create({ reject: { user: User.create({ address }) } }))
      processErrors(response)

      if (!response.accepted) {
        throw new SocialClientIncompleteResponseError()
      }

      return response.accepted
    },
    removeFriendship: async function (address: string): Promise<NonNullable<UpsertFriendshipResponse['accepted']>> {
      const response = await service.upsertFriendship(UpsertFriendshipPayload.create({ delete: { user: User.create({ address }) } }))
      processErrors(response)

      if (!response.accepted) {
        throw new SocialClientIncompleteResponseError()
      }

      return response.accepted
    },
    cancelFriendshipRequest: async function (address: string): Promise<NonNullable<UpsertFriendshipResponse['accepted']>> {
      const response = await service.upsertFriendship(UpsertFriendshipPayload.create({ cancel: { user: User.create({ address }) } }))
      processErrors(response)

      if (!response.accepted) {
        throw new SocialClientIncompleteResponseError()
      }

      return response.accepted
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
    getSocialSettings: async function (): Promise<NonNullable<GetSocialSettingsResponse['ok']>> {
      const response = await service.getSocialSettings(Empty.create())
      processErrors(response)
      if (!hasOkResponse(response)) {
        throw new SocialClientIncompleteResponseError()
      }
      return response.ok
    },
    upsertSocialSettings: async function (settings: Partial<SocialSettings>): Promise<NonNullable<UpsertSocialSettingsResponse['ok']>> {
      const response = await service.upsertSocialSettings(UpsertSocialSettingsPayload.create(settings))
      processErrors(response)
      if (!hasOkResponse(response)) {
        throw new SocialClientIncompleteResponseError()
      }
      return response.ok
    },
    getPrivateMessagesSettings: async function (addresses: string[]): Promise<NonNullable<GetPrivateMessagesSettingsResponse['ok']>> {
      const response = await service.getPrivateMessagesSettings(
        GetPrivateMessagesSettingsPayload.create({ user: addresses.map(address => User.create({ address })) })
      )
      processErrors(response)
      if (!hasOkResponse(response)) {
        throw new SocialClientIncompleteResponseError()
      }
      return response.ok
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
    unblockUser: async function (address: string): Promise<NonNullable<UnblockUserResponse['ok']>> {
      const response = await service.unblockUser(UnblockUserPayload.create({ user: User.create({ address }) }))
      processErrors(response)
      if (!hasOkResponse(response)) {
        throw new SocialClientIncompleteResponseError()
      }
      return response.ok
    },
    blockUser: async function (address: string): Promise<NonNullable<BlockUserResponse['ok']>> {
      const response = await service.blockUser(BlockUserPayload.create({ user: User.create({ address }) }))
      processErrors(response)
      if (!hasOkResponse(response)) {
        throw new SocialClientIncompleteResponseError()
      }
      return response.ok
    },
    startPrivateVoiceChat: async function (address: string): Promise<NonNullable<StartPrivateVoiceChatResponse['ok']>> {
      const response = await service.startPrivateVoiceChat(StartPrivateVoiceChatPayload.create({ callee: User.create({ address }) }))
      processErrors(response)
      if (!hasOkResponse(response)) {
        throw new SocialClientIncompleteResponseError()
      }
      return response.ok
    },
    rejectPrivateVoiceChat: async function (callId: string): Promise<NonNullable<RejectPrivateVoiceChatResponse['ok']>> {
      const response = await service.rejectPrivateVoiceChat(RejectPrivateVoiceChatPayload.create({ callId }))
      processErrors(response)
      if (!hasOkResponse(response)) {
        throw new SocialClientIncompleteResponseError()
      }
      return response.ok
    },
    acceptPrivateVoiceChat: async function (callId: string): Promise<NonNullable<AcceptPrivateVoiceChatResponse['ok']>> {
      const response = await service.acceptPrivateVoiceChat(AcceptPrivateVoiceChatPayload.create({ callId }))
      processErrors(response)
      if (!hasOkResponse(response)) {
        throw new SocialClientIncompleteResponseError()
      }
      return response.ok
    },
    subscribeToPrivateVoiceChatUpdates: async function* () {
      const response = service.subscribeToPrivateVoiceChatUpdates(Empty.create())
      for await (const privateVoiceChatUpdate of response) {
        // TODO: The protocol should return errors in case of failure
        yield privateVoiceChatUpdate
      }
    },
    endPrivateVoiceChat: async function (callId: string): Promise<NonNullable<EndPrivateVoiceChatResponse['ok']>> {
      const response = await service.endPrivateVoiceChat(EndPrivateVoiceChatPayload.create({ callId }))
      processErrors(response)
      if (!hasOkResponse(response)) {
        throw new SocialClientIncompleteResponseError()
      }
      return response.ok
    },
    getIncomingPrivateVoiceChatRequests: async function (): Promise<NonNullable<GetIncomingPrivateVoiceChatRequestResponse['ok']>> {
      const response = await service.getIncomingPrivateVoiceChatRequest(Empty.create())
      processErrors(response)
      if (!hasOkResponse(response)) {
        throw new SocialClientIncompleteResponseError()
      }
      return response.ok
    }
  }
}
