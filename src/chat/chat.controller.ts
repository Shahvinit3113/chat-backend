import { Body, Controller, Get, Post, Req, UseGuards, Param } from '@nestjs/common';
import type { Request } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StartChatDto } from './dto/chat.dto';

@ApiTags('chats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  @Post('start')
  @ApiOperation({ summary: 'Start a chat with another user' })
  async startChat(@Req() req: Request, @Body() dto: StartChatDto) {
    const user = (req as any).user as { sub: string };
    const chat = await this.chatService.startChat(user.sub, dto.otherUserId);
    return { chatId: chat.id, user1Id: chat.user1Id, user2Id: chat.user2Id };
  }

  @Get()
  @ApiOperation({ summary: 'Get all chats for the current user' })
  async getUserChats(@Req() req: Request) {
    const user = (req as any).user as { sub: string };
    return this.chatService.getUserChats(user.sub);
  }

  @Post(':id/passkey')
  @ApiOperation({ summary: 'Set YOUR personal pass key for a chat' })
  async setPassKey(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('passKey') passKey: string,
  ) {
    const user = (req as any).user as { sub: string };
    await this.chatService.setPassKey(id, user.sub, passKey);
    return { success: true, message: 'Your pass key has been set' };
  }
}
