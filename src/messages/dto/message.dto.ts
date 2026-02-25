import { ApiProperty } from '@nestjs/swagger';

class SenderDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    email: string;
}

export class MessageResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    chatId: string;

    @ApiProperty()
    senderId: string;

    @ApiProperty()
    content: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty({ type: SenderDto })
    sender: SenderDto;
}
