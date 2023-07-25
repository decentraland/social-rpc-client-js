import WebSocket, { MessageEvent } from 'isomorphic-ws'
import mitt from 'mitt'
import type { Transport, TransportEvents } from '@dcl/rpc'

export function createWebSocketsTransport(url: string): Transport {
  let socket: WebSocket | undefined
  const events = mitt<TransportEvents>()

  const connect = function () {
    socket = new WebSocket(url)
    socket.binaryType = 'arraybuffer'

    // On close event
    socket.addEventListener('close', () => events.emit('close', {}), {
      once: true
    })

    if (socket.readyState === socket.OPEN) {
      events.emit('connect', { socket })
    } else {
      socket.addEventListener('open', () => events.emit('connect', { socket }), { once: true })
    }

    // On error event
    socket.addEventListener('error', (err: any) => {
      if (err.error) {
        events.emit('error', err.error)
      } else if (err.message) {
        events.emit(
          'error',
          Object.assign(new Error(err.message), {
            colno: err.colno,
            error: err.error,
            filename: err.filename,
            lineno: err.lineno,
            message: err.message
          })
        )
      }
    })

    // On message
    socket.addEventListener('message', (message: MessageEvent) => {
      // Check if the message is a string and what to do with it
      if (message.data instanceof ArrayBuffer) {
        events.emit('message', new Uint8Array(message.data))
      }
    })
  }

  const send = function (message: any) {
    if (socket && socket.readyState === socket.OPEN) {
      if (message instanceof Uint8Array || message instanceof ArrayBuffer) {
        socket.send(message)
      } else {
        const msg = JSON.stringify({
          type: message.type,
          payload: message.payload
        })
        socket.send(msg)
      }
    }
  }

  connect()

  return {
    ...events,
    get isConnected(): boolean {
      return (socket && socket.readyState === socket.OPEN) || false
    },
    sendMessage(message: any) {
      send(message)
    },
    close() {
      if (socket) socket.close()
    }
  }
}
