import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

@Injectable()
export class FirebaseAdminService {
  private app?: App;

  private getFirebaseApp(): App {
    if (this.app) return this.app;

    const existing = getApps()[0];
    if (existing) {
      this.app = existing;
      return existing;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !rawPrivateKey) {
      throw new ServiceUnavailableException(
        "Firebase Admin chưa được cấu hình. Hãy đặt FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL và FIREBASE_PRIVATE_KEY trong apps/api/.env.",
      );
    }

    const privateKey = rawPrivateKey.replace(/\\n/g, "\n");
    this.app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });

    return this.app;
  }

  async verifyIdToken(token: string): Promise<DecodedIdToken> {
    try {
      return await getAuth(this.getFirebaseApp()).verifyIdToken(token, true);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new UnauthorizedException("Firebase ID token không hợp lệ hoặc đã hết hạn.");
    }
  }
}
