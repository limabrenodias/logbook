/* Logbook configuration — the only file to change when deploying your own copy.
   The publishable key is meant to be public; never put the secret (service_role) key here. */
const CONFIG = {
  supabaseUrl: "https://bhbvnjcyubwrnebgewmj.supabase.co",
  supabaseKey: "sb_publishable_VvI57sGerWzNx9HkWIExzA_w0fhKsJa",
  // Cloudflare Turnstile site key — turns on the "I'm human" check on sign-up / sign-in / password reset.
  // Leave empty until you've enabled CAPTCHA in Supabase (Authentication → Attack Protection).
  turnstileSiteKey: "",
  version: "2026.11.23",
  contactEmail: ""   // shown on the privacy page; fill in before going public
};
