import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SessionAuthGuard } from './guards/session-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const authenticated = await this.authService.login(body.email, body.password);

    response.cookie(
      this.authService.getCookieName(),
      authenticated.cookieValue,
      this.authService.buildCookieOptions(),
    );

    return {
      admin: {
        email: authenticated.session.email,
      },
      expiresAt: authenticated.session.expiresAt,
    };
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(
      request.cookies?.[this.authService.getCookieName()],
    );
    response.clearCookie(
      this.authService.getCookieName(),
      this.authService.buildCookieOptions(),
    );

    return {
      success: true,
    };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@Req() request: Request & { admin?: { email: string } }) {
    return {
      admin: request.admin,
    };
  }
}
