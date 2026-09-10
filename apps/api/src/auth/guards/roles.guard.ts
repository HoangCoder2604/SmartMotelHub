import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "../../generated/prisma/client.js";
import { ROLES_KEY } from "../decorators/roles.decorator.js";
import type { AuthRequest } from "../types/auth-request.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!request.currentUser || !requiredRoles.includes(request.currentUser.role)) {
      throw new ForbiddenException("Bạn không có quyền truy cập tài nguyên này.");
    }

    return true;
  }
}
