import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { z } from "zod";
import { UserError, validInstant } from "../domain/validation.ts";
const text = z.string().max(200);
const id = z.string().min(1).max(80);
const instant = z.string().refine(validInstant);
const guest = {
  id,
  fullName: text,
  nationality: text,
  governorate: text,
  city: text,
  identityType: text,
  identityNumber: text,
  identityIssuer: text,
  identityIssuedOn: text,
  createdAt: instant,
};
const settings = z
  .object({
    propertyName: text,
    address: text,
    authority: text,
    recipient: text,
    manager: text,
    managerPhone: text,
    preparer: text,
    preparerPhone: text,
    letter: z.string().max(2000),
    timeZone: text,
  })
  .strict();
const resident = z
  .object({
    ...guest,
    stayId: id,
    roomId: id,
    roomLabel: text,
    checkIn: instant,
    notes: z.string().max(1000),
  })
  .strict();
const reportSchema = z
  .object({
    id,
    issuedAt: instant,
    settings,
    entries: z.array(resident).max(50000),
    version: z.literal(1),
  })
  .strict();
export const backupSchema = z
  .object({
    format: z.literal("nuzul-data"),
    version: z.literal(1),
    guests: z.array(z.object(guest).strict()).max(50000),
    rooms: z
      .array(
        z
          .object({
            id,
            label: text,
            capacity: z.number().int().min(1).max(500),
          })
          .strict(),
      )
      .max(1000),
    stays: z
      .array(
        z
          .object({
            id,
            guestId: id,
            roomId: id,
            checkIn: instant,
            checkOut: instant.nullable(),
            notes: z.string().max(1000),
          })
          .strict(),
      )
      .max(100000),
    history: z
      .array(
        z
          .object({
            id,
            stayId: id,
            roomId: id,
            startedAt: instant,
            endedAt: instant.nullable(),
          })
          .strict(),
      )
      .max(200000),
    reports: z
      .array(
        z
          .object({
            id,
            issuedAt: instant,
            count: z.number().int().min(1),
            snapshot: z
              .string()
              .max(8000000)
              .transform((value, ctx) => {
                try {
                  const report = reportSchema.parse(JSON.parse(value));
                  return JSON.stringify(report);
                } catch {
                  ctx.addIssue({
                    code: "custom",
                    message: "Invalid report snapshot",
                  });
                  return z.NEVER;
                }
              }),
          })
          .strict(),
      )
      .max(20000),
    settings,
  })
  .strict();
export type BackupData = z.infer<typeof backupSchema>;
const envelopeSchema = z
  .object({
    format: z.literal("nuzul-encrypted"),
    version: z.literal(1),
    salt: z.string().regex(/^[a-f0-9]{32}$/),
    nonce: z.string().regex(/^[a-f0-9]{24}$/),
    data: z
      .string()
      .min(32)
      .max(32000032)
      .regex(/^(?:[a-f0-9]{2})+$/),
  })
  .strict();
const AAD = utf8ToBytes("nuzul-backup-v1");
async function derive(password: string, salt: Uint8Array) {
  return pbkdf2Async(sha256, utf8ToBytes(password), salt, {
    c: 600000,
    dkLen: 32,
    asyncTick: 10,
  });
}
export async function encryptBackup(
  data: BackupData,
  password: string,
  random: (n: number) => Uint8Array,
) {
  if (password.length < 12 || password.length > 200)
    throw new UserError(
      "استخدم كلمة مرور للنسخة الاحتياطية من ١٢ إلى ٢٠٠ حرف.",
    );
  const salt = random(16),
    nonce = random(12);
  const key = await derive(password, salt);
  try {
    const body = utf8ToBytes(JSON.stringify(data));
    if (body.length > 16000000)
      throw new UserError("حجم النسخة يتجاوز الحد المتاح في هذه النسخة.");
    const cipher = gcm(key, nonce, AAD).encrypt(body);
    return JSON.stringify({
      format: "nuzul-encrypted",
      version: 1,
      salt: bytesToHex(salt),
      nonce: bytesToHex(nonce),
      data: bytesToHex(cipher),
    });
  } finally {
    key.fill(0);
  }
}
export async function decryptBackup(
  input: string,
  password: string,
): Promise<BackupData> {
  if (input.length > 33000000 || password.length < 12 || password.length > 200)
    throw new UserError("الملف أو كلمة المرور غير صالحين.");
  let json: unknown;
  try {
    json = JSON.parse(input);
  } catch {
    throw new UserError("هذا الملف ليس نسخة نُزل مدعومة.");
  }
  const parsed = envelopeSchema.safeParse(json);
  if (!parsed.success) throw new UserError("هذا الملف ليس نسخة نُزل مدعومة.");
  const { salt, nonce, data } = parsed.data;
  const key = await derive(password, hexToBytes(salt));
  try {
    const plain = gcm(key, hexToBytes(nonce), AAD).decrypt(hexToBytes(data));
    return backupSchema.parse(JSON.parse(new TextDecoder().decode(plain)));
  } catch {
    throw new UserError("تعذر فتح النسخة. تحقق من كلمة المرور وسلامة الملف.");
  } finally {
    key.fill(0);
  }
}
