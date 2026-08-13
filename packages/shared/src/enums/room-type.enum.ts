export const ROOM_TYPES = [
  "LIVING_ROOM",
  "BEDROOM",
  "KITCHEN",
  "BATHROOM",
  "OFFICE",
  "KIDS_ROOM",
] as const;

export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  LIVING_ROOM: "Living Room",
  BEDROOM: "Bedroom",
  KITCHEN: "Kitchen",
  BATHROOM: "Bathroom",
  OFFICE: "Office",
  KIDS_ROOM: "Kids Room",
};
