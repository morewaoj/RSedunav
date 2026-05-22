function getAnonymousId(): string {
  const key = "edunav_anon_id";
  let id = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`))?.[1];
  if (!id) {
    id = crypto.randomUUID();
    document.cookie = `${key}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }
  return id;
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  try {
    const payload = JSON.stringify({
      eventId: crypto.randomUUID(),
      anonymousId: getAnonymousId(),
      eventName,
      properties,
    });

    if (
      (eventName === "page_view" || eventName === "logout") &&
      typeof navigator.sendBeacon === "function"
    ) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      return;
    }

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  } catch {
  }
}
