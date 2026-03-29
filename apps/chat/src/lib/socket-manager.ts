import { io, type Socket } from "socket.io-client"

class SocketManager {
  private static instance: SocketManager
  private socket: Socket | null = null

  static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager()
    }
    return SocketManager.instance
  }

  connect(url: string): Socket {
    if (this.socket?.connected) return this.socket

    this.socket = io(url, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
    })

    return this.socket
  }

  disconnect(): void {
    this.socket?.disconnect()
    this.socket = null
  }

  getSocket(): Socket | null {
    return this.socket
  }

  joinRoom(room: string): void {
    this.socket?.emit("join", room)
  }

  leaveRoom(room: string): void {
    this.socket?.emit("leave", room)
  }
}

export const socketManager = SocketManager.getInstance()
