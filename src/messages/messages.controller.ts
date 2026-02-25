import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { MessageResponseDto } from './dto/message.dto';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chats')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) { }

  @Get(':chatId/messages')
  @ApiOperation({ summary: 'Get message history for a chat' })
  @ApiResponse({ type: [MessageResponseDto] })
  @ApiQuery({ name: 'passKey', required: false })
  getMessages(
    @Req() req: Request,
    @Param('chatId') chatId: string,
    @Query('passKey') passKey: string,
  ) {
    const user = (req as any).user as { sub: string };
    return this.messagesService.getMessages(chatId, user.sub, passKey);
  }
}
