import type { Metadata } from "next";
import { BrandNameForm } from "@/components/brands/BrandNameForm";
import { SwitchBrandButton } from "@/components/brands/SwitchBrandButton";
import { OrganisationForm } from "@/components/leads/OrganisationForm";
import { PageIntro } from "@/components/shell/PageIntro";
import { PageSection } from "@/components/shell/PageSection";
import { createBrandAction, renameBrandAction } from "@/lib/brands/actions";
import { MAX_BRANDS } from "@/lib/brands/limits";
import { countryOptions } from "@/lib/leads/organisation";
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
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow="Brands"
        title={brand.name}
        lead="You are working in this brand. Its designs and files are kept apart from every other brand, including your own others."
      />

      <PageSection id="rename" title="Rename this brand">
        <BrandNameForm
          action={renameBrandAction}
          label="Brand name"
          defaultName={brand.name}
          submitLabel="Save name"
          busyLabel="Saving"
          doneMessage="The name is saved."
        />
      </PageSection>

      <PageSection
        id="organisation"
        title="About your organisation"
        description="What kind of organisation this brand is, and where. It helps us make and deliver your kit."
      >
        <OrganisationForm
          details={details}
          submitLabel="Save details"
          doneMessage="The details are saved."
          countries={countryOptions()}
        />
      </PageSection>

      {others.length > 0 ? (
        <PageSection id="others" title="Your other brands">
          <ul className="flex flex-col divide-y divide-hairline">
            {others.map((other) => (
              <li key={other.id} className="flex items-center justify-between gap-4 py-3">
                <span className="truncate text-[15px] text-ink">{other.name}</span>
                <SwitchBrandButton brandId={other.id} brandName={other.name} />
              </li>
            ))}
          </ul>
        </PageSection>
      ) : null}

      <PageSection
        id="add"
        title="Add a brand"
        description={canAdd ? undefined : `You have ${MAX_BRANDS} brands, which is the most one account can have.`}
      >
        {canAdd ? (
          <BrandNameForm
            action={createBrandAction}
            label="Name of the new brand"
            hint={`You can have ${MAX_BRANDS} brands. You have ${brands.length}.`}
            submitLabel="Create brand"
            busyLabel="Creating"
            withDetails
            countries={countryOptions()}
          />
        ) : null}
      </PageSection>
    </div>
  );
}
