/** Browser side of web push: support checks, permission, subscribe and unsubscribe this device. */
import { api } from "@/lib/api";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** How long to wait for the service worker; in dev (Serwist is disabled) it never registers. */
const SERVICE_WORKER_TIMEOUT_MS = 3000;

export type PushPermission = NotificationPermission | "unsupported";

/** Service worker, Push API and Notification API all present (and the VAPID key is configured). */
export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!VAPID_PUBLIC_KEY;
}

/** iPhone/iPad in a browser tab: push only works once the app is on the home screen (iOS 16.4+). */
export function isIosNotStandalone() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac with a touch screen.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return ios && !standalone;
}

export function getPermission(): PushPermission {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

/** The page's service worker registration, or null when there is none (dev) or it does not get ready in time. */
export async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  if (registration.active) return registration;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((resolve) => setTimeout(() => resolve(null), SERVICE_WORKER_TIMEOUT_MS))]);
}

export async function getCurrentSubscription() {
  const registration = await getPushRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Sends the browser's subscription to the server (idempotent: also reassigns it to the current user). */
export const registerSubscription = (subscription: PushSubscription) => api("/api/push/subscriptions", "POST", subscription.toJSON());

export type SubscribeResult = "subscribed" | "denied" | "unavailable";

/**
 * Asks for the notification permission and subscribes this device. Call it straight from a user gesture
 * (a click): browsers ignore or block the prompt otherwise. Throws when the server does not accept it.
 */
export async function subscribeThisDevice(): Promise<SubscribeResult> {
  if (!isPushSupported()) return "unavailable";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await getPushRegistration();
  if (!registration) return "unavailable";
  const options = { userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) };
  let subscription: PushSubscription;
  try {
    subscription = await registration.pushManager.subscribe(options);
  } catch (error) {
    // A subscription made with another VAPID key blocks the new one: drop it and retry once.
    if (!(error instanceof DOMException) || error.name !== "InvalidStateError") throw error;
    await (await registration.pushManager.getSubscription())?.unsubscribe();
    subscription = await registration.pushManager.subscribe(options);
  }
  try {
    await registerSubscription(subscription);
  } catch (error) {
    // Do not leave a device that the server does not know about.
    await subscription.unsubscribe().catch(() => {});
    throw error;
  }
  return "subscribed";
}

/** Removes this device's subscription from the server and the browser. Throws if the server refuses (the device stays on). */
export async function unsubscribeThisDevice() {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  await api("/api/push/subscriptions", "DELETE", { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

/**
 * For sign-out: stop pushes for the account on this device (the next person to sign in here must not
 * get them). Call it BEFORE signing out (the server request needs the session). Best effort and never
 * throws, so it cannot block the sign-out.
 */
export async function disablePushOnThisDevice() {
  try {
    if (!isPushSupported()) return;
    const subscription = await getCurrentSubscription();
    if (!subscription) return;
    await api("/api/push/subscriptions", "DELETE", { endpoint: subscription.endpoint }, { keepalive: true }).catch(() => {});
    await subscription.unsubscribe();
  } catch {
    // Nothing to do: signing out goes on.
  }
}
