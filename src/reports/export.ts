import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import type { Report } from "../domain/types.ts";
import { UserError } from "../domain/validation.ts";
import { reportHtml } from "./template.ts";
import { reportFileName } from "./names.ts";

async function withPdf<T>(report: Report, work: (uri: string) => Promise<T>) {
  if (!FileSystem.cacheDirectory)
    throw new UserError("تعذر الوصول إلى مساحة الملفات المؤقتة.");
  const directory = FileSystem.cacheDirectory + "nuzul-reports/";
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const file = await Print.printToFileAsync({
    html: reportHtml(report),
    width: 842,
    height: 595,
  });
  const namedUri = directory + reportFileName(report);
  try {
    await FileSystem.moveAsync({ from: file.uri, to: namedUri });
    return await work(namedUri);
  } finally {
    await Promise.allSettled([
      FileSystem.deleteAsync(file.uri, { idempotent: true }),
      FileSystem.deleteAsync(namedUri, { idempotent: true }),
    ]);
  }
}
export async function shareReport(report: Report) {
  if (!(await Sharing.isAvailableAsync()))
    throw new UserError("المشاركة غير متاحة على هذا الجهاز.");
  await withPdf(report, (uri) =>
    Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "مشاركة معلومية النزلاء",
    }),
  );
}
/** The user selects the destination through Android's system directory picker. */
export async function saveReport(report: Report) {
  const permission =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return false;
  await withPdf(report, async (uri) => {
    const data = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const target = await FileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      reportFileName(report),
      "application/pdf",
    );
    try {
      await FileSystem.writeAsStringAsync(target, data, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (error) {
      await FileSystem.deleteAsync(target, { idempotent: true }).catch(
        () => {},
      );
      throw error;
    }
  });
  return true;
}
