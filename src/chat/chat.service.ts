import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) { }

  getChatById(id: string) {
    return this.prisma.chat.findUnique({ where: { id } });
  }

  async startChat(currentUserId: string, otherUserId: string) {
    const [user1Id, user2Id] =
      currentUserId < otherUserId
        ? [currentUserId, otherUserId]
        : [otherUserId, currentUserId];

    const existing = await this.prisma.chat.findFirst({
      where: { user1Id, user2Id },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.chat.create({
      data: { user1Id, user2Id },
    });
  }

  async getUserChats(userId: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enhancedChats = await Promise.all(
      chats.map(async (chat) => {
        const otherUserId = chat.user1Id === userId ? chat.user2Id : chat.user1Id;
        const otherUser = await this.prisma.user.findUnique({
          where: { id: otherUserId },
          select: { id: true, name: true, email: true, avatar: true },
        });
        // Determine if the CURRENT user has set their own passkey
        const hasMyPassKey = chat.user1Id === userId
          ? !!chat.user1PassKey
          : !!chat.user2PassKey;
        return {
          ...chat,
          hasMyPassKey,
          user1PassKey: undefined,
          user2PassKey: undefined,
          otherUser,
        };
      }),
    );

    return enhancedChats;
  }

  async setPassKey(chatId: string, userId: string, passKey: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) return null;

    const field = chat.user1Id === userId ? 'user1PassKey' : 'user2PassKey';
    return this.prisma.chat.update({
      where: { id: chatId },
      data: { [field]: passKey || null },
    });
  }
}
