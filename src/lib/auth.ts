export const TEACHER_SESSION_COOKIE = "teacher_workspace_teacher";
export const DISPLAY_SESSION_COOKIE = "teacher_workspace_display";

type SessionRole = "teacher" | "display";

type SessionPayload = {
  role: SessionRole;
  exp: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encodeBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function sessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SESSION_SECRET 必須至少 32 字元");
  }
  return secret;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return encodeBase64Url(new Uint8Array(signature));
}

function safeEqual(left: string, right: string) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

export async function hashSecret(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return encodeBase64Url(new Uint8Array(digest));
}

export async function matchesSecret(value: string, expectedHash: string) {
  return safeEqual(await hashSecret(value), expectedHash);
}

export async function createSession(role: SessionRole, maxAgeSeconds: number) {
  const payload: SessionPayload = {
    role,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const encoded = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${encoded}.${await sign(encoded)}`;
}

export async function hasSession(token: string | undefined, role: SessionRole) {
  if (!token) return false;
  const [encoded, signature, ...extra] = token.split(".");
  if (!encoded || !signature || extra.length > 0) return false;

  try {
    const expectedSignature = await sign(encoded);
    if (!safeEqual(signature, expectedSignature)) return false;
    const payload = JSON.parse(decoder.decode(decodeBase64Url(encoded))) as SessionPayload;
    return payload.role === role && Number.isInteger(payload.exp) && payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export async function hasTeacherSession(token: string | undefined) {
  return hasSession(token, "teacher");
}

export async function hasDisplaySession(token: string | undefined) {
  return hasSession(token, "display");
}
