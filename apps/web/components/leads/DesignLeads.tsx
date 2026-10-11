import type { DesignLeads as Data } from "@/lib/leads/service";
import { OrganisationPrompt } from "./OrganisationPrompt";
import { QuoteRequest } from "./QuoteRequest";

type Props = Readonly<{
  projectId: string;
  version: number;
  data: Data;
  /** Ask for missing organisation details here. Only beside the design itself. */
  withPrompt?: boolean;
}>;

/** Beside a design: the organisation prompt while details are missing, and "Request a quote". */
export function DesignLeads({ projectId, version, data, withPrompt = false }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {withPrompt && data.askDetails ? <OrganisationPrompt details={data.details} /> : null}
      <QuoteRequest projectId={projectId} version={version} firstDate={data.firstDate} earlier={data.quotes} />
    </div>
  );
}
