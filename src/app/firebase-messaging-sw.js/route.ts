/**
 * The FCM service worker has to live at the origin root and cannot read `process.env`,
 * so it is served from a route with the public Firebase config baked in rather than
 * checked into /public with the values duplicated.
 */
export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const source = `
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();

// Background messages: FCM shows the notification, we only handle the click target.
self.addEventListener("notificationclick", (event) => {
  const link = event.notification?.data?.FCM_MSG?.notification?.click_action
    || event.notification?.data?.link
    || "/dashboard";
  event.notification.close();
  event.waitUntil(clients.openWindow(link));
});
`.trim();

  return new Response(source, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "service-worker-allowed": "/",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
