"use client";

import { ROOM_TYPES, ROOM_TYPE_LABELS, type RoomType } from "@sundera/shared";

interface RoomTypeGridProps {
  value: RoomType | null;
  onChange: (roomType: RoomType) => void;
}

export function RoomTypeGrid({ value, onChange }: RoomTypeGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {ROOM_TYPES.map((roomType) => (
        <button
          key={roomType}
          type="button"
          onClick={() => onChange(roomType)}
          className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
            value === roomType
              ? "border-foreground bg-foreground text-background"
              : "border-foreground/20 hover:border-foreground/40"
          }`}
        >
          {ROOM_TYPE_LABELS[roomType]}
        </button>
      ))}
    </div>
  );
}
