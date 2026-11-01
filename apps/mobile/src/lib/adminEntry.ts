import { Platform } from "react-native";

/** Startades webbappen på /admin (adminens egen ingång)? Avgörs en gång vid start. */
export const isAdminEntry = (): boolean =>
  Platform.OS === "web" && /^\/admin(\/|$)/.test(globalThis.location?.pathname ?? "");
