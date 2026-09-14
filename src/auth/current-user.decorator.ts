import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthTokenPayload } from './auth.guard.js';

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthTokenPayload => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
