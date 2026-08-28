// Seva items + puja sequence metadata.
export type ItemId =
  | "snan" | "chandan" | "dress" | "crown" | "garland"
  | "flower" | "bhog" | "aarti" | "bell" | "sleep";

export interface ItemMeta {
  id: ItemId;
  icon: string;        // MaterialCommunityIcons name (fallback)
  color: string;       // accent
}

// Tray order (bell is interactive but not part of the ordered sequence)
export const ITEMS: ItemMeta[] = [
  { id: "snan", icon: "watering-can", color: "#3FA7D6" },
  { id: "chandan", icon: "brush", color: "#C77F3B" },
  { id: "dress", icon: "tshirt-crew", color: "#B5476E" },
  { id: "crown", icon: "crown", color: "#F4B740" },
  { id: "garland", icon: "flower-poppy", color: "#E8821E" },
  { id: "flower", icon: "flower", color: "#EF5DA8" },
  { id: "bhog", icon: "food-variant", color: "#E0A100" },
  { id: "aarti", icon: "candle", color: "#FF7A00" },
  { id: "bell", icon: "bell-ring", color: "#C0902F" },
  { id: "sleep", icon: "weather-night", color: "#5B6C9C" },
];

// Ordered ritual sequence for the progress indicator.
export const SEQUENCE: ItemId[] = [
  "snan", "chandan", "dress", "crown", "garland", "flower", "bhog", "aarti", "sleep",
];

export const DRESS_SLOTS = ["idol", "idol_blue", "idol_pink"] as const;
export const BHOG_SLOTS = ["makhan", "laddu", "mishri", "fruits"] as const;
