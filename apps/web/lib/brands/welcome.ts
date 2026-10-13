/**
 * The welcome page asks who the person designs for before anything else, then words the rest
 * for that answer: a club is asked for its club name, not a brand name. Everything a person makes
 * still belongs to a brand underneath; only the words change.
 */

export interface WelcomeWording {
  readonly nameLabel: string;
  readonly nameHint: string;
  readonly submit: string;
}

const LATER = "You can change it later.";

const BY_TYPE: Readonly<Record<string, WelcomeWording>> = {
  club: { nameLabel: "Club name", nameHint: `For example, Northfield FC. ${LATER}`, submit: "Set up your club" },
  school: { nameLabel: "School name", nameHint: `For example, Harbour High School. ${LATER}`, submit: "Set up your school" },
  brand: { nameLabel: "Brand name", nameHint: `The name your clothes are sold under. ${LATER}`, submit: "Create brand" },
  gym: { nameLabel: "Gym or academy name", nameHint: `For example, Eastside Boxing Academy. ${LATER}`, submit: "Set up your gym" },
  event: { nameLabel: "Event or company name", nameHint: `For example, City Fun Run 2027. ${LATER}`, submit: "Set up your event" },
};

const GENERAL: WelcomeWording = { nameLabel: "Name of your club, school or brand", nameHint: LATER, submit: "Continue" };

/** The words for the type of organisation chosen, or general words while none is. */
export const welcomeWording = (organisationType: string): WelcomeWording =>
  Object.hasOwn(BY_TYPE, organisationType) ? BY_TYPE[organisationType] : GENERAL;
