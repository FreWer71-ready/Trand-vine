// Mobile first: telefonen är utgångsläget och får hela skärmbredden. På större
// skärmar (surfplatta, dator) centreras appen i en bredare ram, och listor med
// kort visas i flera kolumner. Formulär och detaljsidor behåller läsbar bredd.

import { useWindowDimensions } from "react-native";

export type DeviceSize = "phone" | "tablet" | "desktop";

/** Brytpunkter i px (fönstrets bredd). */
export const BREAKPOINT = { tablet: 600, desktop: 1024 } as const;

/** Största bredd på appens ram per storlek. */
const FRAME_MAX: Record<DeviceSize, number> = { phone: Infinity, tablet: 760, desktop: 1100 };

/** Läsbar bredd för formulär och text på stora skärmar. */
export const READABLE_MAX = 640;

export function useLayout() {
  const { width } = useWindowDimensions();
  const size: DeviceSize = width >= BREAKPOINT.desktop ? "desktop" : width >= BREAKPOINT.tablet ? "tablet" : "phone";
  const frameWidth = Math.min(width, FRAME_MAX[size]);
  return {
    size,
    /** Ramen kring appen: hela bredden på telefon, centrerad med kant på större skärmar. */
    framed: size !== "phone",
    frameMax: FRAME_MAX[size],
    /** Kolumner för kortlistor (källare, historik). */
    columns: frameWidth >= 1000 ? 3 : frameWidth >= 640 ? 2 : 1,
  };
}
