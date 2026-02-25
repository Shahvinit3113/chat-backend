import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class StartChatDto {
    @ApiProperty({ description: 'ID of the user to start a chat with' })
    @IsString()
    @IsNotEmpty()
    otherUserId: string;
}

export class ChatResponseDto {
    @ApiProperty()
    chatId: string;

    @ApiProperty()
    user1Id: string;

    @ApiProperty()
    user2Id: string;

    @ApiProperty({ required: false })
    otherUser?: {
        id: string;
        name: string;
        email: string;
    };
}
