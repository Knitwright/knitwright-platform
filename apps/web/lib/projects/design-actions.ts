import { toolHref } from "@/lib/workspace/tools";

/**
 * What a person can do once a design is drawn: share it with a committee, have photoreal pictures
 * made, ask for a quote, open the full editor, or read the tech pack. The guided flow ends with
 * these, and the first three open their panel in the design workspace, so nobody reaches a dead end.
 */

type DesignActionId = "share" | "photoreal" | "quote" | "editor" | "tech-pack";

interface DesignAction {
  readonly id: DesignActionId;
  readonly label: string;
  /** One sentence on what the action does. */
  readonly sentence: string;
  readonly href: string;
}

const designPage = (projectId: string): string => `/studio/${encodeURIComponent(projectId)}`;

/** Every next step for a design, in the order a club or brand usually takes them. */
export function designActions(projectId: string): readonly DesignAction[] {
  const page = designPage(projectId);
  return [
    {
      id: "share",
      label: "Share with your committee",
      sentence: "Make a link that people without an account can open to see the design, vote on it and leave a comment.",
      href: toolHref(projectId, "share"),
    },
    {
      id: "photoreal",
      label: "Make photoreal images",
      sentence: "Have a front and a back picture made by AI from the drawings, to show people how it will look.",
      href: toolHref(projectId, "photoreal"),
    },
    {
      id: "quote",
      label: "Ask for a quote",
      sentence: "Tell the Knitwright team how many you need and by when, and they will reply with a price by email.",
      href: toolHref(projectId, "quote"),
    },
    {
      id: "editor",
      label: "Open the full editor",
      sentence: "Type measurements, colours, logos, player names and sizes, and see every version of the design.",
      href: page,
    },
    {
      id: "tech-pack",
      label: "See the tech pack",
      sentence: "Read the file a factory works from on screen, and add fabrics, trims and labels.",
      href: `${page}/tech-pack`,
    },
  ];
}
