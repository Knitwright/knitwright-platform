import { describe, expect, it } from "vitest";
import { NO_EMAIL_FOR_THEM, chaseEmail, fillTemplate, phoneDigits, templateFor, whatsAppAddress, type ChaseTemplate } from "./chase";

const WORDS = { player: "Alex", club: "Northside Hockey Club", season: "2027", link: "https://knitwright.test/join/abc" };

const whatsapp: ChaseTemplate = {
  id: "first-ask-whatsapp",
  channel: "whatsapp",
  subject: "",
  body: "Hi {player}, {club} needs your shirt name, number and size for {season}. It takes a minute: {link}",
  note: "Knitwright default wording",
};

const email: ChaseTemplate = {
  id: "first-ask-email",
  channel: "email",
  subject: "{club}: your kit details for {season}",
  body: "Hi {player},\n\nOpen this link:\n{link}",
  note: "Knitwright default wording",
};

describe("fillTemplate", () => {
  it("fills the four things a row may name and leaves everything else as written", () => {
    expect(fillTemplate(whatsapp.body, WORDS)).toBe(
      "Hi Alex, Northside Hockey Club needs your shirt name, number and size for 2027. It takes a minute: https://knitwright.test/join/abc",
    );
  });

  it("fills a name used more than once", () => {
    expect(fillTemplate("{player} {player}", WORDS)).toBe("Alex Alex");
  });

  it("leaves a name it does not know alone, rather than emptying it", () => {
    expect(fillTemplate("{coach} asked", WORDS)).toBe("{coach} asked");
  });
});

describe("phoneDigits", () => {
  it("keeps the digits and nothing else, so nothing a club pasted can change the address", () => {
    expect(phoneDigits("+44 (0)1632 960-000")).toBe("4401632960000");
    expect(phoneDigits("07700 900000?text=evil")).toBe("07700900000");
  });
});

describe("whatsAppAddress", () => {
  it("is a wa.me address with the words already written, so no API and no account is needed", () => {
    const address = whatsAppAddress(whatsapp, WORDS, "+44 1632 960000") ?? "";

    expect(address.startsWith("https://wa.me/441632960000?text=")).toBe(true);
    expect(decodeURIComponent(address.split("?text=")[1] ?? "")).toContain("Northside Hockey Club");
  });

  it("escapes the words, so a club's own name cannot break the address", () => {
    const address = whatsAppAddress(whatsapp, { ...WORDS, club: "A&B #1 Club" }, "07700900000") ?? "";

    expect(address).not.toContain("&B");
    expect(address).not.toContain("#1");
  });

  it("has no address at all for a number with too few digits", () => {
    expect(whatsAppAddress(whatsapp, WORDS, "")).toBeNull();
    expect(whatsAppAddress(whatsapp, WORDS, "12345")).toBeNull();
  });
});

describe("chaseEmail", () => {
  it("fills the subject and the words, and sends a reply back to the club", () => {
    const message = chaseEmail(email, WORDS, "alex@example.com", "kit@club.test");

    expect(message).toEqual({
      to: "alex@example.com",
      subject: "Northside Hockey Club: your kit details for 2027",
      body: "Hi Alex,\n\nOpen this link:\nhttps://knitwright.test/join/abc",
      replyTo: "kit@club.test",
    });
  });

  it("takes no reply address where the club's own is not known", () => {
    expect(chaseEmail(email, WORDS, "alex@example.com", null).replyTo).toBeNull();
  });
});

describe("templateFor", () => {
  it("finds the row of one channel, and says there is none rather than guessing wording", () => {
    expect(templateFor([whatsapp, email], "email")?.id).toBe("first-ask-email");
    expect(templateFor([whatsapp], "email")).toBeNull();
  });
});

describe("what the club is told", () => {
  it("names the one thing they can do about a player with no address on the list", () => {
    expect(NO_EMAIL_FOR_THEM).toContain("Add one");
  });
});
