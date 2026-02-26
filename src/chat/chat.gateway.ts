import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from '../messages/messages.service';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Track online users: userId -> Set of socketIds (one user may have multiple tabs)
  private onlineUsers = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly messagesService: MessagesService,
    private readonly chatService: ChatService,
  ) { }

  private getUserIdFromSocket(socket: Socket): string | null {
    const token =
      socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || typeof token !== 'string') return null;
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      return payload.sub;
    } catch {
      return null;
    }
  }

  handleConnection(client: Socket) {
    const userId = this.getUserIdFromSocket(client);
    if (!userId) {
      client.disconnect();
      return;
    }

    // Track socket
    if (!this.onlineUsers.has(userId)) {
      this.onlineUsers.set(userId, new Set());
    }
    this.onlineUsers.get(userId)!.add(client.id);

    // Broadcast that this user is online
    this.server.emit('userOnline', { userId });

    // Send the full list of online userIds to the newly connected client
    const onlineUserIds = Array.from(this.onlineUsers.keys());
    client.emit('onlineUsers', onlineUserIds);
  }

  handleDisconnect(client: Socket) {
    const userId = this.getUserIdFromSocket(client);
    if (!userId) return;

    const sockets = this.onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.onlineUsers.delete(userId);
        // Only broadcast offline if user has no more connected sockets
        this.server.emit('userOffline', { userId });
      }
    }
  }

  @SubscribeMessage('joinChat')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const userId = this.getUserIdFromSocket(client);
    if (!userId) {
      client.disconnect();
      return;
    }

    const chat = await this.chatService.getChatById(data.chatId);
    if (!chat || (chat.user1Id !== userId && chat.user2Id !== userId)) {
      client.disconnect();
      return;
    }

    client.join(data.chatId);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string; content: string; replyToId?: string },
  ) {
    const userId = this.getUserIdFromSocket(client);
    if (!userId) {
      client.emit('error', 'Unauthorized');
      return;
    }

    if (!data.chatId || !data.content) {
      client.emit('error', 'Invalid message data');
      return;
    }

    const chat = await this.chatService.getChatById(data.chatId);
    if (!chat || (chat.user1Id !== userId && chat.user2Id !== userId)) {
      client.emit('error', 'Access denied to this chat');
      return;
    }

    const message = await this.messagesService.createMessage(
      data.chatId,
      userId,
      data.content,
      data.replyToId
    );

    this.server.to(data.chatId).emit('newMessage', {
      ...message,
      senderId: userId,
    });
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const userId = this.getUserIdFromSocket(client);
    if (!userId) return;

    console.log(`User ${userId} marking chatId ${data.chatId} as read`);
    await this.messagesService.markAsRead(data.chatId, userId);
    this.server.to(data.chatId).emit('messagesRead', { chatId: data.chatId, readerId: userId });
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const userId = this.getUserIdFromSocket(client);
    if (!userId) return;
    client.to(data.chatId).emit('userTyping', { chatId: data.chatId, userId });
  }

  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const userId = this.getUserIdFromSocket(client);
    if (!userId) return;
    client.to(data.chatId).emit('userStopTyping', { chatId: data.chatId, userId });
  }

  @SubscribeMessage('likeMessage')
  async handleLikeMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string; messageId: string },
  ) {
    const userId = this.getUserIdFromSocket(client);
    if (!userId) return;

    if (!data.chatId || !data.messageId) {
      throw new WsException('Invalid like data');
    }

    const chat = await this.chatService.getChatById(data.chatId);
    if (!chat || (chat.user1Id !== userId && chat.user2Id !== userId)) {
      throw new WsException('Access denied');
    }

    const updatedMessage = await this.messagesService.toggleLike(data.messageId, userId);
    if (updatedMessage) {
      this.server.to(data.chatId).emit('messageLiked', updatedMessage);
    }
  }
}
