import Link from "next/link";

import { getAllEquipmentModels } from "@/services/equipment-model/equipment-model.service";
import { getAllLocations } from "@/services/location/location.service";

import { createEquipment } from "../actions";

export default async function NewEquipmentPage() {
  const models = await getAllEquipmentModels();
  const locations = await getAllLocations();

  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mb-6">
        <Link href="/equipment" className="text-sm text-neutral-400">
          Back to Equipment
        </Link>
        <h1 className="mt-4 text-3xl font-bold">Add Equipment</h1>
      </div>

      <form action={createEquipment} className="max-w-xl space-y-4">
        <input name="assetTag" required placeholder="Asset Tag" className="w-full rounded bg-neutral-900 p-3 border border-neutral-700" />
        <input name="serialNumber" placeholder="Serial Number" className="w-full rounded bg-neutral-900 p-3 border border-neutral-700" />

        <select name="modelId" required className="w-full rounded bg-neutral-900 p-3 border border-neutral-700">
          <option value="">Select Model</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.manufacturer.name} {model.name} - {model.category}
            </option>
          ))}
        </select>

        <select name="locationId" required className="w-full rounded bg-neutral-900 p-3 border border-neutral-700">
          <option value="">Select Location</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>

        <input name="condition" placeholder="Condition" className="w-full rounded bg-neutral-900 p-3 border border-neutral-700" />

        <textarea name="notes" placeholder="Notes" className="w-full rounded bg-neutral-900 p-3 border border-neutral-700" />

        <button className="rounded bg-white px-5 py-3 font-bold text-black">
          Save Equipment
        </button>
      </form>
    </main>
  );
}
