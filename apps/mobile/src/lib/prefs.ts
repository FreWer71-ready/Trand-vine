// Senaste valen vid registrering (hur flaskan anskaffades, butik, valuta),
// så att nästa flaska oftast bara behöver ett tryck. Sparas på enheten.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AcquisitionType } from "@trand-vine/core";

const KEY = "trandvine.lastBottle";

export interface LastChoices {
  acquisition: AcquisitionType;
  store: string;
  currency: string;
  location: string;
}

export async function loadLastChoices(): Promise<Partial<LastChoices>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<LastChoices>) : {};
  } catch {
    return {};
  }
}

export async function saveLastChoices(c: LastChoices) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // Går det inte att spara får användaren fylla i igen nästa gång.
  }
}
