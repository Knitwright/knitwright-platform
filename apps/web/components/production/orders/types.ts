export type Cut = "mens" | "womens" | "junior" | "unisex";

export interface Row {
  name: string;
  number: string;
  sizeLabel: string;
  cut: Cut;
  quantity: number;
}

export interface Issue {
  readonly row: number;
  readonly severity: "error" | "warning";
  readonly message: string;
}

export interface Context {
  readonly run: readonly string[];
  readonly hasNamePlace: boolean;
}

export interface OrderSummary {
  readonly id: string;
  readonly name: string;
  readonly players: number;
  readonly updatedAt: string;
}

export interface OrderDraft {
  readonly id: string | null;
  readonly name: string;
  readonly rows: readonly Row[];
}

export const CUT_CHOICES: readonly { id: Cut; label: string }[] = [
  { id: "mens", label: "Men's" },
  { id: "womens", label: "Women's" },
  { id: "junior", label: "Junior" },
  { id: "unisex", label: "Unisex" },
];

export const blankRow = (context: Context): Row => ({ name: "", number: "", sizeLabel: context.run[0] ?? "", cut: "mens", quantity: 1 });
