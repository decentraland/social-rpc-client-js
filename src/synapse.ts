import 'cross-fetch/polyfill'
import { SocialClient } from 'dcl-social-client'
import { AuthIdentity, Authenticator } from '@dcl/crypto'

export function connectToSynapse(synapseUrl: string, address: string, identity: AuthIdentity): Promise<SocialClient> {
  const timestamp = Date.now()
  const authChain = Authenticator.signPayload(identity, timestamp.toString())

  return SocialClient.loginToServer(synapseUrl, address, timestamp, authChain, {
    disablePresence: true
  })
}
