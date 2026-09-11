"use client";

import { AuthProvider } from "../components/auth-provider";
import { PushNotificationManager } from "../components/push-notification-manager";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PushNotificationManager />
      {children}
    </AuthProvider>
  );
}
