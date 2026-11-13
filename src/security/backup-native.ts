import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as Crypto from "expo-crypto";
import { decryptBackup, encryptBackup } from "./backup.ts";
import type { Repository } from "../database/repository.ts";
import { UserError } from "../domain/validation.ts";
export async function shareBackup(repo: Repository, password: string) {
  if (!(await Sharing.isAvailableAsync()))
    throw new UserError("المشاركة غير متاحة.");
  const encrypted = await encryptBackup(
    await repo.exportData(),
    password,
    (n) => Crypto.getRandomBytes(n),
  );
  const uri =
    FileSystem.cacheDirectory +
    `nuzul-${new Date().toISOString().slice(0, 10)}.nuzul`;
  try {
    await FileSystem.writeAsStringAsync(uri, encrypted);
    await Sharing.shareAsync(uri, {
      mimeType: "application/octet-stream",
      dialogTitle: "حفظ نسخة نُزل المشفرة",
    });
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
export async function restoreBackup(repo: Repository, password: string) {
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return false;
  const asset = result.assets[0];
  if (!asset) throw new UserError("لم يُحدد ملف.");
  try {
    const info = await FileSystem.getInfoAsync(asset.uri);
    if (!info.exists || info.isDirectory || info.size > 33000000)
      throw new UserError("الملف غير موجود أو يتجاوز ٣٣ ميغابايت.");
    const data = await decryptBackup(
      await FileSystem.readAsStringAsync(asset.uri),
      password,
    );
    await repo.restoreData(data);
    return true;
  } finally {
    await FileSystem.deleteAsync(asset.uri, { idempotent: true });
  }
}
