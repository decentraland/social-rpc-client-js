import { AuthIdentity } from '@dcl/crypto'
import { createRpcClient } from '@dcl/rpc'
import { loadService } from '@dcl/rpc/dist/codegen'
import { processErrors, SynapseLoginError } from './errors'
import {
  FriendshipsServiceDefinition,
  Payload,
  MutualFriendsPayload,
  UpdateFriendshipPayload
} from './protobuff-types/decentraland/social/friendships/friendships.gen'
import { connectToSynapse } from './synapse'
import { createWebSocketsTransport } from './transport'

export async function createSocialClient(synapseUrl: string, socialClientRpcUrl: string, userAddress: string, identity: AuthIdentity) {
  const socialClient = await connectToSynapse(synapseUrl, userAddress, identity)
  const synapseToken = socialClient.getAccessToken()
  if (!synapseToken) {
    throw new SynapseLoginError()
  }

  const webSocketsTransport = createWebSocketsTransport(socialClientRpcUrl)
  const rpcClient = await createRpcClient(webSocketsTransport)
  const port = await rpcClient.createPort('social')
  const service = loadService(port, FriendshipsServiceDefinition)

  return {
    disconnect: async () => {
      await socialClient.logout()
      webSocketsTransport.close()
    },
    getFriends: async function* () {
      const response = service.getFriends(Payload.create({ synapseToken }))
      for await (const friends of response) {
        processErrors(friends)
        yield friends.users
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
        yield mutualFriend.users
      }
    },
    getRequestEvents: async () => {
      const response = await service.getRequestEvents(Payload.create({ synapseToken }))
      processErrors(response)
      return response.events
    },
    requestFriendship: async (address: string) => {
      const response = await service.updateFriendshipEvent({
        event: { request: { user: { address } } },
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
    subscribeToFriendshipRequests: async function* () {
      const response = service.subscribeFriendshipEventsUpdates(Payload.create({ synapseToken }))

      for await (const friendshipEvent of response) {
        processErrors(friendshipEvent)
        yield friendshipEvent.events
      }
    }
  }
}
