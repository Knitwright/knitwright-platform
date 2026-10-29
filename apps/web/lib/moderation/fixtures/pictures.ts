import sharp from "sharp";

/** A made-up "mark": a dark diagonal band and a dot on white. Not anybody's logo. */
export async function madeUpMark(size = 200, colour = "#1b2a6b"): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#ffffff"/>
    <polygon points="0,70 70,0 100,0 100,10 10,100 0,100" fill="${colour}"/>
    <circle cx="75" cy="75" r="14" fill="${colour}"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Stripes running the other way: a different picture. They run across, so nothing changes along a row: a hash that only
 * compares sideways cannot tell this picture from a plain white one, which is why the hash also compares downwards.
 */
export async function otherPicture(size = 200): Promise<Buffer> {
  const bands = Array.from({ length: 5 }, (_, i) => `<rect x="0" y="${i * 20}" width="100" height="10" fill="#c8102e"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ffffff"/>${bands}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** A picture with almost nothing in it: a soft grey wash. Too plain to compare with anything. */
export async function plainPicture(size = 200): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <defs><linearGradient id="g"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f2f2f2"/></linearGradient></defs>
    <rect width="100" height="100" fill="url(#g)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
