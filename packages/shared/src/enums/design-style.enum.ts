export const DESIGN_STYLES = [
  "MODERN",
  "SCANDINAVIAN",
  "MINIMALISM",
  "LOFT_INDUSTRIAL",
  "BOHO",
  "JAPANESE",
  "CLASSIC",
  "PROVENCE",
  "ART_DECO",
  "MID_CENTURY",
  "COASTAL",
  "FARMHOUSE",
  "MEDITERRANEAN",
  "ECLECTIC",
] as const;

export type DesignStyle = (typeof DESIGN_STYLES)[number];

export const DESIGN_STYLE_LABELS: Record<DesignStyle, string> = {
  MODERN: "Modern",
  SCANDINAVIAN: "Scandinavian",
  MINIMALISM: "Minimalism",
  LOFT_INDUSTRIAL: "Loft / Industrial",
  BOHO: "Boho",
  JAPANESE: "Japanese",
  CLASSIC: "Classic",
  PROVENCE: "Provence",
  ART_DECO: "Art Deco",
  MID_CENTURY: "Mid-Century",
  COASTAL: "Coastal",
  FARMHOUSE: "Farmhouse",
  MEDITERRANEAN: "Mediterranean",
  ECLECTIC: "Eclectic",
};
