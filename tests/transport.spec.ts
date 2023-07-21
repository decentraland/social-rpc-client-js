import { createWebSocketsTransport } from '../src/transport'

describe('when creating the websockets transport', () => {
  it('should connect to the websockets server and return a Transport', () => {
    createWebSocketsTransport('ws://localhost:8080')
  })
})
