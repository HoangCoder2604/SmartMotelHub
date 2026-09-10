import type { DecodedIdToken } from "firebase-admin/auth";
import type { User } from "../../generated/prisma/client.js";

export type AuthRequest = {
  headers: Record<string, string | string[] | undefined>;
  firebaseUser?: DecodedIdToken;
  currentUser?: User;
};
