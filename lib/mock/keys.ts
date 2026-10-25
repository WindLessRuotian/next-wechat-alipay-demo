import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Mock-mode key material, generated locally on first use and stored in
 * `.mock-keys/` (git-ignored). Nothing here is a real credential: it lets the
 * mock "provider" sign notifications with a private key while the app verifies
 * them with the matching public key — exactly the same code path as live.
 */
export interface MockKeys {
  wechatApiV3Key: string; // 32 bytes
  wechatMerchant: KeyPairPem; // stands in for apiclient_key.pem
  wechatMerchantSerial: string;
  wechatPlatform: KeyPairPem; // stands in for the "微信支付公钥"
  wechatPlatformKeyId: string; // PUB_KEY_ID_...
  alipayApp: KeyPairPem; // app private key (merchant side)
  alipayPlatform: KeyPairPem; // stands in for the "支付宝公钥"
}
interface KeyPairPem {
  privateKey: string;
  publicKey: string;
}

const DIR = path.join(process.cwd(), ".mock-keys");
const FILE = path.join(DIR, "keys.json");

function pair(): KeyPairPem {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { privateKey, publicKey };
}

function generate(): MockKeys {
  return {
    wechatApiV3Key: crypto.randomBytes(24).toString("base64url").slice(0, 32),
    wechatMerchant: pair(),
    wechatMerchantSerial: crypto.randomBytes(20).toString("hex").toUpperCase(),
    wechatPlatform: pair(),
    wechatPlatformKeyId: `PUB_KEY_ID_MOCK${crypto.randomInt(1e9, 1e10 - 1)}`,
    alipayApp: pair(),
    alipayPlatform: pair(),
  };
}

let cached: MockKeys | undefined;

export function mockKeys(): MockKeys {
  if (cached) return cached;
  if (!fs.existsSync(FILE)) {
    fs.mkdirSync(DIR, { recursive: true });
    // Write to a temp file, then hard-link into place: link() fails atomically with
    // EEXIST if another worker won the race, so nobody ever reads a half-written file.
    const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(generate(), null, 2), { mode: 0o600 });
    try {
      fs.linkSync(tmp, FILE);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
  cached = JSON.parse(fs.readFileSync(FILE, "utf8")) as MockKeys;
  return cached;
}
