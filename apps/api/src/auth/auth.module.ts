import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { FirebaseAdminService } from "./firebase-admin.service.js";
import { FirebaseAuthGuard } from "./guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "./guards/registered-user.guard.js";
import { RolesGuard } from "./guards/roles.guard.js";
import { VerifiedEmailGuard } from "./guards/verified-email.guard.js";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    FirebaseAdminService,
    FirebaseAuthGuard,
    RegisteredUserGuard,
    RolesGuard,
    VerifiedEmailGuard,
  ],
  exports: [
    AuthService,
    FirebaseAdminService,
    FirebaseAuthGuard,
    RegisteredUserGuard,
    RolesGuard,
    VerifiedEmailGuard,
  ],
})
export class AuthModule {}
