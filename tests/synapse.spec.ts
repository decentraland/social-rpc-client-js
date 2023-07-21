import { SocialClient } from 'dcl-social-client'
import { HDNodeWallet, Wallet } from 'ethers'
import { Authenticator, AuthLink, type AuthIdentity } from '@dcl/crypto'
import { connectToSynapse } from '../src/synapse'
import { createIdentity } from './utils'

describe('when connecting to synapse', () => {
  let wallet: HDNodeWallet
  let synapseUrl: string
  let userAddress: string
  let identity: AuthIdentity
  let client: SocialClient
  let loginMock: jest.SpyInstance
  let timestamp: number
  let authChain: AuthLink[]

  beforeEach(async () => {
    wallet = Wallet.createRandom()
    identity = await createIdentity(wallet, 1000)
    client = {} as SocialClient
    loginMock = jest.spyOn(SocialClient, 'loginToServer')
    loginMock.mockResolvedValueOnce(client)
    timestamp = Date.now()
    authChain = Authenticator.signPayload(identity, timestamp.toString())
    jest.spyOn(Date, 'now').mockReturnValueOnce(timestamp)
  })

  it('should log in to it and return a client', async () => {
    const client = await connectToSynapse(synapseUrl, userAddress, identity)
    expect(loginMock).toHaveBeenCalledWith(synapseUrl, userAddress, timestamp, authChain, { disablePresence: true })
    expect(client).toBe(client)
  })
})
