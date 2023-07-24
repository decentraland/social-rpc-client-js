import fetch from 'cross-fetch'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { SynapseLoginError, isErrorWithMessage } from './errors'

type SynapseResponse = {
  user_id: string
  social_user_id: string
  access_token: string
  device_id: string
  home_server: string
  well_known: {
    'm.homeserver': {
      base_url: string
    }
  }
}

export async function getSynapseToken(synapseUrl: string, address: string, identity: AuthIdentity): Promise<string> {
  const timestamp = Date.now()
  const authChain = Authenticator.signPayload(identity, timestamp.toString())

  try {
    const response = await fetch(`${synapseUrl}/_matrix/client/r0/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        auth_chain: authChain,
        identifier: {
          type: 'm.id.user',
          user: address
        },
        timestamp: timestamp.toString(),
        type: 'm.login.decentraland'
      })
    })

    if (response.ok) {
      const responseBody: SynapseResponse = await response.json()
      return responseBody.access_token
    } else {
      throw new Error(`Synapse server responded with a ${response.status} status code`)
    }
  } catch (error) {
    throw new SynapseLoginError(isErrorWithMessage(error) ? error.message : 'Unknown error')
  }
}
