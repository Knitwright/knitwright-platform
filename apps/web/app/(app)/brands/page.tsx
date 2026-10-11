import type { Metadata } from "next";
import { BrandNameForm } from "@/components/brands/BrandNameForm";
import { SwitchBrandButton } from "@/components/brands/SwitchBrandButton";
import { OrganisationForm } from "@/components/leads/OrganisationForm";
import { createBrandAction, renameBrandAction } from "@/lib/brands/actions";
import { MAX_BRANDS } from "@/lib/brands/limits";
import { getBrandDetails } from "@/lib/leads/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Brands" };

export default async function BrandsPage() {
  const { brand, brands } = await requireMember();
  const others = brands.filter((other) => other.id !== brand.id);
  const canAdd = brands.length < MAX_BRANDS;
  const details = await getBrandDetails(await sessionClient(), brand.id);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wider text-muted">Brands</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{brand.name}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          You are working in this brand. Its designs and files are kept apart from every other
          brand, including your own others.
        </p>
      </header>

      <section
        aria-labelledby="rename"
        className="rounded-2xl border border-hairline bg-surface p-6"
      >
        <h2 id="rename" className="text-base font-semibold text-ink">
          Rename this brand
        </h2>
        <div className="mt-4">
          <BrandNameForm
            action={renameBrandAction}
            label="Brand name"
            defaultName={brand.name}
            submitLabel="Save name"
            busyLabel="Saving"
            doneMessage="The name is saved."
          />
        </div>
      </section>

      <section aria-labelledby="organisation" className="rounded-2xl border border-hairline bg-surface p-6">
        <h2 id="organisation" className="text-base font-semibold text-ink">
          About your organisation
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          What kind of organisation this brand is, and where. It helps us make and deliver your kit.
        </p>
        <div className="mt-4">
          <OrganisationForm details={details} submitLabel="Save details" doneMessage="The details are saved." />
        </div>
      </section>

      {others.length > 0 ? (
        <section
          aria-labelledby="others"
          className="rounded-2xl border border-hairline bg-surface p-6"
        >
          <h2 id="others" className="text-base font-semibold text-ink">
            Your other brands
          </h2>
          <ul className="mt-4 flex flex-col divide-y divide-hairline">
            {others.map((other) => (
              <li key={other.id} className="flex items-center justify-between gap-4 py-3">
                <span className="truncate text-[15px] text-ink">{other.name}</span>
                <SwitchBrandButton brandId={other.id} brandName={other.name} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="add" className="rounded-2xl border border-hairline bg-surface p-6">
        <h2 id="add" className="text-base font-semibold text-ink">
          Add a brand
        </h2>
        {canAdd ? (
          <div className="mt-4">
            <BrandNameForm
              action={createBrandAction}
              label="Name of the new brand"
              hint={`You can have ${MAX_BRANDS} brands. You have ${brands.length}.`}
              submitLabel="Create brand"
              busyLabel="Creating"
              withDetails
            />
          </div>
        ) : (
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            You have {MAX_BRANDS} brands, which is the most one account can have.
          </p>
        )}
      </section>
    </div>
  );
}
