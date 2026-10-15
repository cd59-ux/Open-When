// Sends one notification to one phone. The hub calls this; the private key lives in Netlify settings.
const webpush = require("web-push");

const MESSAGES = {
  tap:    { title: "{name} is thinking of you ♥",        body: "Tap to send one back." },
  letter: { title: "A new letter is ready to open ✉️",   body: "One of your envelopes just got filled in." },
  reply:  { title: "{name} replied to your letter 💗",   body: "Open the hub to see what he sent." },
  pocket: { title: "{name} tucked a note in your pocket 💌", body: "Tap “Give me a little note” to find it." },
  wall:   { title: "New note on the fridge 🧲",           body: "{name} left you something." },
  photo:  { title: "New photo on the fridge 📸",          body: "{name} pinned up a picture." },
  song:   { title: "{name} sent you a song 🎶",           body: "Open the hub to give it a listen." },
  memory: { title: "{name} added to your story ✨",        body: "A new memory is on the timeline." },
  movie:  { title: "{name} is ready for movie night 🍿",  body: "Tap “I'm ready” and the countdown starts." },
  test:   { title: "It works! 🔔",                         body: "You'll get a buzz when something happens in the hub." },
};
const PUSH_HOSTS = /(^|\.)(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };
  let req;
  try { req = JSON.parse(event.body || "{}"); } catch (_) { return { statusCode: 400, body: "bad json" }; }
  const m = MESSAGES[req.type];
  const sub = req.sub;
  if (!m || !sub || typeof sub.endpoint !== "string" || !sub.keys) return { statusCode: 400, body: "bad request" };
  let host = "";
  try { host = new URL(sub.endpoint).hostname; } catch (_) {}
  if (!PUSH_HOSTS.test(host)) return { statusCode: 400, body: "unknown push service" };
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return { statusCode: 500, body: "keys missing" };

  const name = String(req.name || "").replace(/[^\p{L}\p{N} '’.-]/gu, "").trim().slice(0, 24) || "Your person";
  const fill = (s) => s.replace(/\{name\}/g, name);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://www.netlify.app", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  try {
    await webpush.sendNotification(sub, JSON.stringify({ title: fill(m.title), body: fill(m.body), tag: req.type, url: "./" }), { TTL: 86400 });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    const gone = e.statusCode === 404 || e.statusCode === 410;
    return { statusCode: gone ? 410 : 502, body: JSON.stringify({ ok: false, gone, status: e.statusCode || null }) };
  }
};
