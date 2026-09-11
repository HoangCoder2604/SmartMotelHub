"use client";

import { useEffect } from "react";
import { useAuth } from "./auth-provider";
import { pushConfigured, registerPushIfAlreadyGranted, subscribeForegroundPush } from "../lib/push-notifications";

export function PushNotificationManager() {
  const { firebaseUser } = useAuth();

  useEffect(() => {
    if (!firebaseUser || !pushConfigured || typeof window === "undefined") return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const start = async () => {
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          const idToken = await firebaseUser.getIdToken();
          await registerPushIfAlreadyGranted(idToken);
        }

        unsubscribe = await subscribeForegroundPush(({ title, body, href }) => {
          if (cancelled || !("Notification" in window) || Notification.permission !== "granted") return;
          const notification = new Notification(title, { body, data: { href } });
          notification.onclick = () => {
            window.focus();
            window.location.assign(href.startsWith("/") ? href : "/notifications");
            notification.close();
          };
        });
      } catch {
        // Không chặn app nếu trình duyệt không hỗ trợ push hoặc FCM tạm lỗi.
      }
    };

    void start();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [firebaseUser]);

  return null;
}
