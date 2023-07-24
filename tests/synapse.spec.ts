import { HDNodeWallet, Wallet } from 'ethers'
import nock from 'nock'
import { Authenticator, AuthLink, type AuthIdentity } from '@dcl/crypto'
import { getSynapseToken } from '../src/synapse'
import { createIdentity } from './utils'

describe('when connecting to synapse', () => {
  let wallet: HDNodeWallet
  let synapseUrl: string
  let identity: AuthIdentity
  let timestamp: number
  let authChain: AuthLink[]
  let accessToken: string

  beforeEach(async () => {
    wallet = Wallet.createRandom()
    identity = await createIdentity(wallet, 1000)
    timestamp = Date.now()
    authChain = Authenticator.signPayload(identity, timestamp.toString())
    jest.spyOn(Date, 'now').mockReturnValueOnce(timestamp)
    synapseUrl = 'https://social.decentraland.org'
    accessToken = 'access_token'
    nock(synapseUrl)
      .post('/_matrix/client/r0/login', {
        auth_chain: authChain,
        identifier: {
          type: 'm.id.user',
          user: wallet.address
        },
        timestamp: timestamp.toString(),
        type: 'm.login.decentraland'
      })
      .reply(200, {
        access_token: accessToken
      })
  })

  it("should log in to it and return the user's access token", () => {
    expect(getSynapseToken(synapseUrl, wallet.address, identity)).resolves.toBe(accessToken)
  })
})
