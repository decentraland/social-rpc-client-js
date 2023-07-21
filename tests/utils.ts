import { Wallet, Signer } from 'ethers'
import { AuthIdentity, Authenticator } from '@dcl/crypto'

export async function createIdentity(signer: Signer, expiration: number): Promise<AuthIdentity> {
  const address = await signer.getAddress()

  const wallet = Wallet.createRandom()
  const payload = {
    address: wallet.address,
    privateKey: wallet.privateKey,
    publicKey: wallet.publicKey
  }

  const identity = await Authenticator.initializeAuthChain(address, payload, expiration, (message: string) => signer.signMessage(message))

  return identity
}
