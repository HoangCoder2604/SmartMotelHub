import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { FirebaseAdminService } from "../firebase-admin.service.js";
import type { AuthRequest } from "../types/auth-request.js";

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebaseAdmin: FirebaseAdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const authorization = request.headers.authorization;
    const value = Array.isArray(authorization) ? authorization[0] : authorization;

    if (!value?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Thiếu Bearer token.");
    }

    const token = value.slice("Bearer ".length).trim();
    if (!token) throw new UnauthorizedException("Bearer token rỗng.");

    request.firebaseUser = await this.firebaseAdmin.verifyIdToken(token);
    return true;
  }
}
