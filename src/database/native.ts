import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { Repository } from "./repository.ts";
let instance: Promise<Repository> | undefined;
async function open() {
  // Remove plaintext print files left only if a previous process ended mid-share.
  await FileSystem.deleteAsync(FileSystem.cacheDirectory + "Print", {
    idempotent: true,
  });
  await FileSystem.deleteAsync(FileSystem.cacheDirectory + "nuzul-reports", {
    idempotent: true,
  });
  let key = await SecureStore.getItemAsync("nuzul.database-key.v1");
  if (!key) {
    key = Array.from(await Crypto.getRandomBytesAsync(32), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    await SecureStore.setItemAsync("nuzul.database-key.v1", key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  if (!/^[a-f0-9]{64}$/.test(key))
    throw new Error(
      "تعذر قراءة مفتاح البيانات. لا تحذف التطبيق؛ استعد نسختك الاحتياطية.",
    );
  const db = await SQLite.openDatabaseAsync("nuzul-v1.db");
  try {
    // SQLCipher PRAGMA cannot be parameter-bound. The random hex key is strictly validated above.
    await db.execAsync(`PRAGMA key = "x'${key}'";`);
    const cipher = await db.getFirstAsync<Record<string, string>>(
      "PRAGMA cipher_version",
    );
    if (!cipher || !Object.values(cipher)[0]) {
      throw new Error(
        "التشفير غير متوفر في هذه النسخة. استخدم APK مخصصًا، وليس Expo Go.",
      );
    }
    const repo = new Repository(
      {
        exec: (sql) => db.execAsync(sql),
        run: (sql, ...p) => db.runAsync(sql, ...p),
        all: <T>(sql: string, ...p: (string | number | null)[]) =>
          db.getAllAsync<T>(sql, ...p),
        first: <T>(sql: string, ...p: (string | number | null)[]) =>
          db.getFirstAsync<T>(sql, ...p),
      },
      () => Crypto.randomUUID(),
    );
    await repo.initialize();
    return repo;
  } catch (error) {
    await db.closeAsync().catch(() => {});
    throw error;
  }
}
export function openRepository() {
  if (!instance)
    instance = open().catch((error) => {
      instance = undefined;
      throw error;
    });
  return instance;
}
