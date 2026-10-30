import "server-only";
import { factoryStore } from "@/lib/factory/server";
import { priceBookOf, type PriceBook } from "./book";

/**
 * Joins the catalogue's price book (`book.ts`) to the server's own client. The factory tables have
 * no browser access at all, so this is the only way a page can read a price, a lead time or a
 * fabric. Nothing here decides who may see what: the catalogue is platform data every signed-in
 * member reads, and the page checks the session before it calls this.
 */
export const priceBook = (): Promise<PriceBook> => priceBookOf(factoryStore());
