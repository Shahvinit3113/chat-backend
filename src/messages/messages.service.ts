import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.JWT_SECRET || 'vinit-secret-key-123456';
const KEY = crypto.createHash('sha256').update(String(SECRET_KEY)).digest('base64').substring(0, 32);

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) { }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY), iv);
    let encrypted = cipher.update(text, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decrypt(text: string): string {
    try {
      const parts = text.split(':');
      if (parts.length !== 2) return text;
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(KEY), iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');
      return decrypted;
    } catch (e) {
      console.error('Decryption failed, returning raw text', e);
      return text;
    }
  }

  async createMessage(chatId: string, senderId: string, content: string) {
    const encryptedContent = this.encrypt(content);
    const message = await this.prisma.message.create({
      data: { chatId, senderId, content: encryptedContent },
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return { ...message, content: this.decrypt(message.content) };
  }

  async getMessages(chatId: string, userId: string, passKey?: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Check only the REQUESTING user's passkey, not the other user's
    const myPassKey = chat.user1Id === userId ? chat.user1PassKey : chat.user2PassKey;
    if (myPassKey && myPassKey !== passKey) {
      throw new ForbiddenException('Invalid or missing pass key');
    }

    const messages = await this.prisma.message.findMany({
      where: { chatId },
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((msg) => ({
      ...msg,
      content: this.decrypt(msg.content),
    }));
  }

  async toggleLike(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) return null;

    let updatedLikes = [...message.likedByIds];
    if (updatedLikes.includes(userId)) {
      updatedLikes = updatedLikes.filter((id) => id !== userId);
    } else {
      updatedLikes.push(userId);
    }

    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: { likedByIds: updatedLikes },
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return { ...updatedMessage, content: this.decrypt(updatedMessage.content) };
  }
}
