import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getMessaging, type BatchResponse } from "firebase-admin/messaging";

export type PushPayload = {
  title: string;
  body: string;
  href?: string | null;
  type?: string | null;
  notificationId?: string | null;
};

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

  async sendPushToTokens(tokens: string[], payload: PushPayload): Promise<BatchResponse[]> {
    const uniqueTokens = [...new Set(tokens.filter(Boolean))];
    if (!uniqueTokens.length) return [];

    const results: BatchResponse[] = [];
    const messaging = getMessaging(this.getFirebaseApp());

    for (let offset = 0; offset < uniqueTokens.length; offset += 500) {
      const chunk = uniqueTokens.slice(offset, offset + 500);
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          title: payload.title,
          body: payload.body,
          href: payload.href ?? "/notifications",
          type: payload.type ?? "GENERAL",
          notificationId: payload.notificationId ?? "",
        },
        webpush: {
          headers: { Urgency: "high" },
        },
      });
      results.push(response);
    }

    return results;
  }
}
