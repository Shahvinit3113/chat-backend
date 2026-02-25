import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);
    private transporter: nodemailer.Transporter;

    constructor(private readonly configService: ConfigService) {
        const port = parseInt(this.configService.get('SMTP_PORT', '587'), 10);
        const secure = String(this.configService.get('SMTP_SECURE')) === 'true';

        this.transporter = nodemailer.createTransport({
            host: this.configService.get('SMTP_HOST'),
            port: port,
            secure: secure,
            auth: {
                user: this.configService.get('SMTP_USER'),
                pass: this.configService.get('SMTP_PASS'),
            },
        });
    }


    async sendNotificationEmail(to: string, senderName: string, chatLink: string) {
        try {
            const mailOptions = {
                from: this.configService.get('SMTP_FROM', '"Chat App" <notifications@chatapp.com>'),
                to,
                subject: `New message from ${senderName}`,
                text: `Hello, you have a new message from ${senderName} in Chat App. View it here: ${chatLink}`,
                html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2>New Message!</h2>
            <p>Hello,</p>
            <p>You have received a new message.</p>
            <a href="${chatLink}" style="display: inline-block; padding: 10px 20px; background-color: #8b5cf6; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">View Message</a>
            <p style="margin-top: 20px; font-size: 0.8rem; color: #666;">If the button doesn't work, copy and paste this link: ${chatLink}</p>
          </div>
        `,
            };

            const info = await this.transporter.sendMail(mailOptions);
            this.logger.log(`Notification email sent to ${to}: ${info.messageId}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to send notification email to ${to}`, error);
            return false;
        }
    }
}
