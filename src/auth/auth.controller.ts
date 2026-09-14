import { Body, Controller, Get, HttpCode, NotFoundException, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { AuthGuard, type AuthTokenPayload } from './auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { SignupDto } from './dto/signup.dto.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Post('signup')
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.signup(dto);
    this.setAuthCookie(res, token);
    return user;
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.login(dto);
    this.setAuthCookie(res, token, dto.rememberMe ?? true);
    return user;
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.cookieName, { path: '/' });
    return { success: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() payload: AuthTokenPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return this.usersService.toPublicUser(user);
  }

  private get cookieName() {
    return this.configService.get<string>('COOKIE_NAME') ?? 'finly_token';
  }

  private setAuthCookie(res: Response, token: string, persistent = true) {
    res.cookie(this.cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      ...(persistent ? { maxAge: SEVEN_DAYS_MS } : {}),
    });
  }
}
