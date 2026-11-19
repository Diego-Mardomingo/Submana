/**
 * A short tap of the phone's vibration motor, for gestures that reach their point (pull to
 * refresh armed, swipe back past its threshold) and for confirmations.
 *
 * Android: the Vibration API. iPhone: Safari has no Vibration API, but since iOS 18 a native
 * switch (`<input type="checkbox" switch>`) plays the system haptic when it toggles, so a hidden
 * one is clicked through its label. Elsewhere, and with "Reduce motion", it does nothing.
 */
export function haptic() {
  if (typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(10);
    } catch {
      // Blocked until the user has interacted with the page.
    }
    return;
  }
  if (!/iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))) return;
  const label = document.createElement("label");
  label.ariaHidden = "true";
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.append(input);
  document.head.append(label);
  label.click();
  label.remove();
}
