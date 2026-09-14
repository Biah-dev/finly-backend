import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AuthTokenPayload {
  sub: string;
  email: string;
}

export type AuthenticatedRequest = Request & { user: AuthTokenPayload };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookieName = this.configService.get<string>('COOKIE_NAME') ?? 'finly_token';
    const token = request.cookies?.[cookieName];

    if (!token) {
      throw new UnauthorizedException('Not authenticated.');
    }

    try {
      request.user = await this.jwtService.verifyAsync<AuthTokenPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session.');
    }
  }
}
