import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const auth = (req.headers?.authorization as string | undefined) ?? '';

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = auth.slice(7).trim();
    try {
      const payload = this.jwt.verify(token);
      req.user = payload; // attach payload for handlers
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
