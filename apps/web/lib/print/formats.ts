import { PRINT_FORMATS } from "@/lib/production/contract";

export { PRINT_FORMATS };
export type PrintFormat = (typeof PRINT_FORMATS)[number];
