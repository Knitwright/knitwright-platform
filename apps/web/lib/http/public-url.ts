/**
 * The one list of addresses that are not a public web page.
 *
 * Z3 wrote it for the benchmark fetch (`lib/benchmarks/fetch.ts`, decision 0084) and did not export
 * it, so L7 wrote the same line again for the brand import (`lib/brand-studio/import/fetch.ts`,
 * decision 0102) with a comment asking for the two to become one exported constant the next time
 * either directory was opened. Review v5 (decision 0110) opened both: this is that constant, and
 * neither fetcher carries a list of its own any more.
 *
 * It lives here, under `lib/http`, because it belongs to no feature: anything on the server that is
 * about to fetch an address a person typed should ask this first. It is a check on the address as
 * written, and that is all it is — **what it does not do** is listed below, because a reader who
 * takes it for a complete guard will be wrong:
 *
 *  * it does not look at where a redirect goes. Both callers fetch with `redirect: "follow"`, so a
 *    public page that answers 302 to a private address is still followed;
 *  * it does not resolve the name, so a public name with a private address behind it passes;
 *  * it reads the four-part form of an IPv4 address only, so the short, hexadecimal, octal and
 *    decimal forms of a loopback address pass;
 *  * of IPv6 it knows `::1` alone, so the IPv4-mapped, link-local and unique-local forms pass;
 *  * it says nothing about the port, and nothing about `100.64.0.0/10`.
 *
 * Review v5 lists each of those as a finding for the security review to answer; this module is the
 * one place a fix for any of them now has to go.
 */

/**
 * Addresses that are not a public web page: loopback and the private IPv4 ranges by number, and the
 * `.local`, `.internal` and `.localhost` suffixes by name. `169.254.0.0/16` covers the cloud
 * metadata address, and `.internal` covers the name it also answers to.
 */
export const PRIVATE_HOST =
  /^(localhost|\[?::1\]?|0\.0\.0\.0|10\.\d+\.\d+\.\d+|127\.\d+\.\d+\.\d+|169\.254\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$|\.(local|internal|localhost)$/i;

/**
 * Whether a URL's hostname is one this server will not fetch. Takes the hostname as `URL` gives it,
 * which is already lower-cased and, for IPv6, already without its brackets.
 */
export const isPrivateHost = (hostname: string): boolean => PRIVATE_HOST.test(hostname);
