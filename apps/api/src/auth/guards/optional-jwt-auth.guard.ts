import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** 有 token 则解析用户，无 token 或无效 token 不报错（user 为 undefined） */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return true;
    return (super.canActivate(context) as Promise<boolean>).catch(() => true);
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser | undefined {
    if (err || !user) return undefined;
    return user;
  }
}
