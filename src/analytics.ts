/**
 * PostHog page views, page leaves and clicks, cookieless. Only on the deployed site: the production
 * build gate keeps it out of the dev server, the hostname gate out of `vite preview` and other copies.
 * Loaded as its own chunk after the app renders; if it fails or is blocked, nothing else notices.
 */
export function startAnalytics() {
  if (!import.meta.env.PROD || location.hostname !== "raffinate.github.io") return
  import("posthog-js")
    .then(({ default: posthog }) =>
      posthog.init("phc_ohN6L9dWEEsU5vs4xycnopj4oELq4eREkEwHdUjxNhoR", {
        api_host: "https://eu.i.posthog.com",
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: true,
        disable_session_recording: true,
        disable_surveys: true,
        disable_product_tours: true,
        disable_conversations: true,
        disable_web_experiments: true,
        capture_heatmaps: false,
        capture_dead_clicks: false,
        capture_performance: false,
        capture_exceptions: false,
        advanced_disable_flags: true,
        disable_external_dependency_loading: true,
        cookieless_mode: "always",
        person_profiles: "identified_only",
      }),
    )
    .catch(() => {})
}
