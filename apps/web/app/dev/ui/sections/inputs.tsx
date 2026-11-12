"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { Checkbox, Radio, SearchInput, Select, TextInput, Toggle } from "@/components/ui/Inputs";
import { NumberInput } from "@/components/ui/NumberInput";
import { Segmented } from "@/components/ui/Tabs";
import { Row, Section } from "../frame";

function TextInputs() {
  return (
    <Row label="Text input: default, error (with its line under the field), disabled">
      <div className="w-72">
        <TextInput aria-label="Design name" placeholder="Home kit 2027" />
      </div>
      <div className="w-72">
        <Field name="club" label="Club name" errors={["Enter the club's name"]} defaultValue="" />
      </div>
      <div className="w-72">
        <TextInput aria-label="Article code" defaultValue="JSY-SS-01" disabled />
      </div>
    </Row>
  );
}

function SearchAndSelect() {
  return (
    <Row label="Search field and select">
      <div className="w-80">
        <SearchInput aria-label="Search products" placeholder="Search products" />
      </div>
      <div className="w-60">
        <Select aria-label="Sort" defaultValue="recent">
          <option value="recent">Recent</option>
          <option value="name">Name</option>
        </Select>
      </div>
      <div className="w-60">
        <Select aria-label="Fabric" defaultValue="" invalid>
          <option value="">Choose a fabric</option>
        </Select>
      </div>
    </Row>
  );
}

function Measurements() {
  const [chest, setChest] = useState(520);
  const [offset, setOffset] = useState(12.5);
  return (
    <Row label="Number with unit: ↑ ↓ step 1, Shift steps 10">
      <div className="w-40">
        <NumberInput label="Chest width" unit="mm" value={chest} onChange={setChest} min={400} max={700} />
      </div>
      <div className="w-40">
        <NumberInput label="Logo offset" unit="cm" value={offset} onChange={setOffset} step={0.5} bigStep={5} />
      </div>
      <div className="w-40">
        <NumberInput label="Sleeve length" unit="in" value={8.25} onChange={() => undefined} disabled />
      </div>
    </Row>
  );
}

function Choices() {
  const [view, setView] = useState("2d");
  const [billing, setBilling] = useState("yearly");
  const [on, setOn] = useState(true);
  return (
    <>
      <Row label="Segmented control (arrow keys move)">
        <Segmented label="View" value={view} onChange={setView} options={[{ id: "2d", label: "2D" }, { id: "3d", label: "3D" }, { id: "techpack", label: "Tech pack" }]} />
        <Segmented label="Billing" value={billing} onChange={setBilling} options={[{ id: "monthly", label: "Monthly" }, { id: "yearly", label: "Yearly" }]} />
      </Row>
      <Row label="Toggle: on, off, disabled">
        <Toggle label="Show seams" checked={on} onChange={setOn} />
        <Toggle label="Safe zone" checked={!on} onChange={(value) => setOn(!value)} />
        <Toggle label="Snap to grid" checked={false} onChange={() => undefined} disabled />
      </Row>
      <Row label="Checkbox and radio: checked, unchecked, disabled">
        <Checkbox label="Include sizes" defaultChecked />
        <Checkbox label="Add names" />
        <Checkbox label="Locked by QC" disabled defaultChecked />
        <fieldset className="flex gap-4">
          <legend className="sr-only">Unit</legend>
          <Radio name="unit" label="mm" defaultChecked />
          <Radio name="unit" label="cm" />
          <Radio name="unit" label="in" disabled />
        </fieldset>
      </Row>
    </>
  );
}

export function InputsSection() {
  return (
    <Section id="inputs" title="Inputs">
      <TextInputs />
      <SearchAndSelect />
      <Measurements />
      <Choices />
    </Section>
  );
}
