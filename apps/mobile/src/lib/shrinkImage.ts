// Krymper ett foto innan det skickas till etikettläsningen. Ett fullstort
// mobilfoto är flera MB och tar lång tid att ladda upp på mobilnät; för att
// läsa text på en etikett räcker ca 1 600 px på längsta sidan.

import { Platform } from "react-native";

const MAX_SIDE = 1600;

/** Tar en data-URL eller base64 och returnerar base64-JPEG (utan prefix). */
export async function shrinkForUpload(uri: string | undefined, base64: string | undefined): Promise<string> {
  if (Platform.OS !== "web" || !uri?.startsWith("data:")) return base64 ?? "";
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("bild"));
    img.src = uri;
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8).replace(/^data:image\/\w+;base64,/, "");
}
