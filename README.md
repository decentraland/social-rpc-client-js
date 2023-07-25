<p align="center">
  <a href="https://decentraland.org">
    <img alt="Decentraland" src="https://decentraland.org/images/logo.png" width="60" />
  </a>
</p>
<h1 align="center">
  Decentraland Social Service JS Client
</h1>

The Decentraland Social Service JS Client is a Websocket client which uses the [DCL RPC protocol](https://github.com/decentraland/rpc) to communicate with the [Decentraland Social Service](https://github.com/decentraland/social-service).

## Collaboration

### Setting up the development environment

In order to build the client, you'll need to have [Node.js](https://nodejs.org/en/) and [Protocol Buffers](https://grpc.io/docs/protoc-installation/) installed.

### Installing the dependencies

Run the NPM install command to install all the dependencies needed to run the project.

```bash
npm install
```

### Building the client

Run the NPM build command to build the client.

```bash
npm build
```

This command will:
1. Compile the protocol buffer's definitions for the RPC protocol of the Social Service, generating the corresponding TypeScript definitions.
2. Compile the TypeScript code of the client.

A distributable will be generated in the `dist` folder, containing all the client's code and types.

## Using the client

### Basic setup and usage

To use the client, install the package in your NPM project:

```bash
npm install -S @dcl/social-rpc-client
```

Import the client creator function from the installed package:

```typescript
import { createSocialClient } from "@dcl/social-client";
```

Create a new client instance by providing the client with:
1. A URL to the Social Service's REST API
2. A URL to the Social Service's Websocket endpoint
3. The user's address (the same as the one used to sign the identity)
4. An identity, signed with the user's wallet.

```typescript
import { createSocialClient } from "@dcl/social-client";
import { Wallet } from 'ethers'

// Generate a random wallet for testing purposes or use the user's one in production environments.
const wallet = Wallet.createRandom()
const identity = await createIdentity(wallet, expiration)

const socialClient = await createSocialClient(
  "https://social.decentraland.org",
  "wss://social-service.decentraland.org",
  wallet.address,
  identity
);
```

The `createSocialClient` will connect perform the required operations to connect to the Social Service and will return the connected client.


Use the client to interact with the Social Service:

```typescript
import { createSocialClient } from "@dcl/social-client";

const socialClient = await createSocialClient(
  "https://social.decentraland.org",
  "wss://social-service.decentraland.org",
  wallet.address,
  identity
);

const friends = socialClient.getFriends()
for await (const friend of friends) {
  console.log(friend)
}
```

The client exposes the methods available through the [social protobuff](https://github.com/decentraland/protocol/blob/main/public/social.proto) and a disconnect method which disconnects the client from the Social Service.


### Generating an identity

To authenticate users with the Social Service, you'll need to generate an identity for them. To do so, the `@dcl/crypto` library provides the `Authenticator.initializeAuthChain` method. Use it to generate an identity for your users:

```typescript
  import { Wallet } from 'ethers'
  import { Authenticator } from '@dcl/crypto'
  // Generate a random wallet for testing purposes or use the user's one in production environments.
  const userWallet = Wallet.createRandom()

  // Generate an identity for the user.
  const address = await userWallet.getAddress()
  const ephemeralWallet = Wallet.createRandom()
  const payload = {
    address: ephemeralWallet.address,
    privateKey: ephemeralWallet.privateKey,
    publicKey: ephemeralWallet.publicKey
  }
  const identity = await Authenticator.initializeAuthChain(address, payload, expiration, (message: string) => signer.signMessage(message))
```