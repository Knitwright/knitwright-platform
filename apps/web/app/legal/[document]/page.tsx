import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/shell/PublicHeader";
import { Notice } from "@/components/ui/Notice";
import { LEGAL_DOCUMENTS, legalDocument } from "@/lib/legal/documents";
import { DRAFT_NOTICE, type LegalBlock } from "@/lib/legal/model";

/** Only the documents that exist. Any other address is a page that does not exist. */
export const dynamicParams = false;

export const generateStaticParams = () => LEGAL_DOCUMENTS.map((doc) => ({ document: doc.slug }));

export async function generateMetadata({ params }: PageProps<"/legal/[document]">): Promise<Metadata> {
  return { title: legalDocument((await params).document)?.title ?? "Not found" };
}

function Block({ block }: Readonly<{ block: LegalBlock }>) {
  if (block.kind === "p") return <p className="text-[15px] leading-relaxed text-ink-2">{block.text}</p>;
  if (block.kind === "list") {
    return (
      <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-ink-2">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {block.head.map((heading) => (
              <th key={heading} className="border-b border-hairline py-2 pr-4 font-semibold text-ink">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join("|")}>
              {row.map((value, index) => (
                <td key={`${index}-${value}`} className="border-b border-hairline py-2 pr-4 align-top text-ink-2">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The terms, the privacy notice and the data-processing terms. Public, and the same for everyone. */
export default async function LegalPage({ params }: PageProps<"/legal/[document]">) {
  const doc = legalDocument((await params).document);
  if (!doc) notFound();

  return (
    <>
      <PublicHeader width="max-w-3xl">
        <nav aria-label="Legal" className="flex flex-wrap gap-1 text-sm">
          {LEGAL_DOCUMENTS.map((other) => (
            <Link
              key={other.slug}
              href={`/legal/${other.slug}`}
              aria-current={other.slug === doc.slug ? "page" : undefined}
              className="nav-pill rounded-full px-3 py-1.5 text-muted aria-[current=page]:bg-white/12 aria-[current=page]:text-white"
            >
              {other.title}
            </Link>
          ))}
        </nav>
      </PublicHeader>
      <main id="main" className="rise mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-10">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{doc.title}</h1>
          {doc.status === "draft" ? <Notice tone="warn">{DRAFT_NOTICE}</Notice> : null}
          <p className="text-sm text-muted">Last updated: {doc.updated}</p>
          <p className="text-[15px] leading-relaxed text-ink-2">{doc.summary}</p>
        </header>
        {doc.sections.map((section, index) => (
          <section key={section.heading} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">
              {index + 1}. {section.heading}
            </h2>
            {section.blocks.map((block, blockIndex) => (
              <Block key={blockIndex} block={block} />
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
