import { apiFetch } from "./api";
import { firebaseConfigured, getFirebaseApp } from "./firebase";

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";
const PUSH_OPT_IN_KEY = "smartmotel:fcm-push-enabled";

export const pushConfigured = firebaseConfigured && Boolean(vapidKey);

export type PushEnableResult = {
  permission: NotificationPermission;
  registered: boolean;
};

function assertBrowserPushAvailable() {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Trình duyệt này không hỗ trợ Web Push.");
  }
  if (!pushConfigured) {
    throw new Error("Thiếu NEXT_PUBLIC_FIREBASE_VAPID_KEY trong apps/web/.env.local.");
  }
}

async function getMessagingIfSupported() {
  assertBrowserPushAvailable();
  const { getMessaging, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) throw new Error("Firebase Messaging không được hỗ trợ trên trình duyệt này.");
  return getMessaging(getFirebaseApp());
}

async function getServiceWorkerRegistration() {
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return registration;
}

async function getCurrentFcmToken() {
  const messaging = await getMessagingIfSupported();
  const registration = await getServiceWorkerRegistration();
  const { getToken } = await import("firebase/messaging");
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Firebase không trả về FCM token cho trình duyệt này.");
  return { messaging, token };
}

export async function enablePushNotifications(idToken: string): Promise<PushEnableResult> {
  assertBrowserPushAvailable();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { permission, registered: false };

  const { token } = await getCurrentFcmToken();
  await apiFetch(
    "/notifications/push/device",
    { method: "POST", body: JSON.stringify({ token }) },
    idToken,
  );
  window.localStorage.setItem(PUSH_OPT_IN_KEY, "1");

  return { permission, registered: true };
}

export async function registerPushIfAlreadyGranted(idToken: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (!pushConfigured || Notification.permission !== "granted") return false;
  if (window.localStorage.getItem(PUSH_OPT_IN_KEY) !== "1") return false;

  const { token } = await getCurrentFcmToken();
  await apiFetch(
    "/notifications/push/device",
    { method: "POST", body: JSON.stringify({ token }) },
    idToken,
  );
  return true;
}

export async function disablePushNotifications(idToken: string) {
  if (typeof window === "undefined") return;

  const wasOptedIn = window.localStorage.getItem(PUSH_OPT_IN_KEY) === "1";
  window.localStorage.removeItem(PUSH_OPT_IN_KEY);
  if (!wasOptedIn || !("Notification" in window) || Notification.permission !== "granted" || !pushConfigured) return;

  const { messaging, token } = await getCurrentFcmToken();
  await apiFetch(
    "/notifications/push/device",
    { method: "DELETE", body: JSON.stringify({ token }) },
    idToken,
  );

  const { deleteToken } = await import("firebase/messaging");
  await deleteToken(messaging);
}

export async function subscribeForegroundPush(
  handler: (payload: { title: string; body: string; href: string }) => void,
) {
  if (typeof window === "undefined" || !pushConfigured) return () => undefined;

  const messaging = await getMessagingIfSupported();
  const { onMessage } = await import("firebase/messaging");
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? payload.data?.title ?? "SmartMotel Hub";
    const body = payload.notification?.body ?? payload.data?.body ?? "Bạn có thông báo mới.";
    const href = payload.data?.href ?? "/notifications";
    handler({ title, body, href });
  });
}
