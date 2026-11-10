import { createHmac } from "crypto";

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

/** STUN always; TURN from env (short-lived HMAC secret or static creds). */
export function getMeetIceServers(): IceServerConfig[] {
  const servers: IceServerConfig[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  const turnUrls = process.env.TURN_URLS?.trim();
  if (!turnUrls) return servers;

  const urls = turnUrls.split(",").map((u) => u.trim()).filter(Boolean);
  if (!urls.length) return servers;

  const secret = process.env.TURN_SECRET?.trim();
  if (secret) {
    const ttl = Math.max(60, Number(process.env.TURN_CREDENTIAL_TTL_SECONDS ?? 3600) || 3600);
    const expiry = Math.floor(Date.now() / 1000) + ttl;
    const username = `${expiry}:storytime`;
    const credential = createHmac("sha1", secret).update(username).digest("base64");
    servers.push({ urls, username, credential });
    return servers;
  }

  const username = process.env.TURN_USERNAME?.trim();
  const credential = process.env.TURN_CREDENTIAL?.trim();
  if (username && credential) {
    servers.push({ urls, username, credential });
  }

  return servers;
}
