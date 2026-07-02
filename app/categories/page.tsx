import { createServerComponentClient } from "@/lib/supabase/server";
import { CATEGORIES, TYPE_LABELS } from "@/lib/taxonomy";
import ReviewQueue from "@/components/ReviewQueue";

// Categories tab: taxonomy reference + the categorisation approval queue.
export default async function CategoriesPage() {
  const supabase = createServerComponentClient();
  const { data: pending } = await supabase
    .from("transactions")
    .select("id, date, amount, merchant, detail, category, sub_category, type")
    .eq("status", "pending_review")
    .order("date", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold">Categories</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {pending?.length ?? 0} transactions need categorisation review.
        </p>
      </section>

      <ReviewQueue items={pending ?? []} />

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-300">Taxonomy reference</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-400">
            <tr>
              <th className="py-2">Category</th>
              <th className="py-2">Type</th>
              <th className="py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((c) => (
              <tr key={c.name} className="border-t border-neutral-800">
                <td className="py-2">{c.name}</td>
                <td className="py-2">{TYPE_LABELS[c.type]}</td>
                <td className="py-2 text-neutral-500">{c.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
