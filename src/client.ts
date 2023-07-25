import { AuthIdentity } from '@dcl/crypto'
import { createRpcClient } from '@dcl/rpc/dist/client'
import { loadService } from '@dcl/rpc/dist/codegen'
import { processErrors } from './errors'
import {
  FriendshipsServiceDefinition,
  Payload,
  MutualFriendsPayload,
  UpdateFriendshipPayload
} from './protobuff-types/decentraland/social/friendships/friendships.gen'
import { getSynapseToken } from './synapse'
import { createWebSocketsTransport } from './transport'

export async function createSocialClient(synapseUrl: string, socialClientRpcUrl: string, userAddress: string, identity: AuthIdentity) {
  const synapseToken = await getSynapseToken(synapseUrl, userAddress, identity)
  const webSocketsTransport = createWebSocketsTransport(socialClientRpcUrl)
  const rpcClient = await createRpcClient(webSocketsTransport)
  const port = await rpcClient.createPort('social')
  const service = loadService(port, FriendshipsServiceDefinition)

  return {
    disconnect: () => {
      webSocketsTransport.close()
    },
    getFriends: async function* () {
      const response = service.getFriends(Payload.create({ synapseToken }))
      for await (const friends of response) {
        processErrors(friends)
        yield friends.users?.users ?? []
      }
    },
    getMutualFriends: async function* (address: string) {
      const response = service.getMutualFriends(
        MutualFriendsPayload.create({
          user: { address },
          authToken: { synapseToken }
        })
      )
      for await (const mutualFriend of response) {
        processErrors(mutualFriend)
        yield mutualFriend.users?.users ?? []
      }
    },
    getRequestEvents: async () => {
      const response = await service.getRequestEvents(Payload.create({ synapseToken }))
      processErrors(response)
      return response.events
    },
    requestFriendship: async (address: string, message?: string) => {
      const response = await service.updateFriendshipEvent({
        event: { request: { user: { address }, message } },
        authToken: { synapseToken }
      })
      processErrors(response)
      return response.event
    },
    cancelFriendshipRequest: async (address: string) => {
      const response = await service.updateFriendshipEvent(
        UpdateFriendshipPayload.create({
          event: { cancel: { user: { address } } },
          authToken: { synapseToken }
        })
      )
      processErrors(response)
      return response.event
    },
    acceptFriendshipRequest: async (address: string) => {
      const response = await service.updateFriendshipEvent(
        UpdateFriendshipPayload.create({
          event: { accept: { user: { address } } },
          authToken: { synapseToken }
        })
      )
      processErrors(response)
      return response.event
    },
    rejectFriendshipRequest: async (address: string) => {
      const response = await service.updateFriendshipEvent(
        UpdateFriendshipPayload.create({
          authToken: { synapseToken },
          event: { reject: { user: { address } } }
        })
      )
      processErrors(response)
      return response.event
    },
    removeFriend: async (address: string) => {
      const response = await service.updateFriendshipEvent(
        UpdateFriendshipPayload.create({
          authToken: { synapseToken },
          event: { delete: { user: { address } } }
        })
      )
      processErrors(response)
      return response.event
    },
    subscribeToFriendshipRequests: async function* () {
      const response = service.subscribeFriendshipEventsUpdates(Payload.create({ synapseToken }))

      for await (const friendshipEvent of response) {
        processErrors(friendshipEvent)
        yield friendshipEvent.events?.responses ?? []
      }
    }
  }
}
