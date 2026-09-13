"use client";
import { useEffect } from "react";

/** Registers the service worker so the app can be installed to the home screen. */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failures shouldn't surface to the user — the app works
      // fine without it, it just isn't installable.
    });
  }, []);
  return null;
}
