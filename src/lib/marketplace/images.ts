import { photoUrl } from "@/lib/supabase";

/** Most photos a listing can have. Matches the database limit. */
export const MAX_PHOTOS = 10;

/**
 * Listing photos are stored as paths in the listing-photos bucket ("<user id>/<file>.jpg").
 * Full URLs and data URLs pass through unchanged. Empty means "no photo".
 */
export function resolveImage(ref: string | undefined): string {
  if (!ref) return "";
  if (/^(https?:|data:|blob:)/.test(ref)) return ref;
  return photoUrl(ref);
}

/** Resize a photo so the long side is at most `maxSize` px and re-encode it as a JPEG. */
export function compressPhoto(file: File, maxSize = 1600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error(`"${file.name}" isn't an image`));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Couldn't read "${file.name}". Try a JPG or PNG.`));
    };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Your browser can't process photos"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Couldn't process that photo"))),
        "image/jpeg",
        0.85,
      );
    };
    img.src = url;
  });
}

/** Move one item in a list from `from` to `to`, returning a new list. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}
