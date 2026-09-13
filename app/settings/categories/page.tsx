import { PageHeader, TypeBadge } from "@/components/ui";
import AddSubCategoryForm from "@/components/AddSubCategoryForm";
import SubCategoryPill from "@/components/SubCategoryPill";
import { CATEGORIES } from "@/lib/taxonomy";
import { fetchSubCategoriesByCategory, fetchSubCategoryUsageCounts } from "@/lib/subCategoriesTable";

export const dynamic = "force-dynamic";

export default async function CategoryRulesPage() {
  const [byCategory, usage] = await Promise.all([fetchSubCategoriesByCategory(), fetchSubCategoryUsageCounts()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories & Sub-categories"
        subtitle="The rule engine behind categorisation. Categories are fixed in code. Add new sub-categories here any time; an unused one (0 transactions) can be deleted with the ×."
      />

      <div className="card divide-y divide-gray-100">
        {CATEGORIES.map((c) => {
          const subs = byCategory[c.name] ?? [];
          return (
            <div key={c.name} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.name}</span>
                <TypeBadge type={c.type} />
                <span className="text-xs text-gray-400">{subs.length} sub-categories</span>
              </div>
              {c.notes && <p className="mt-1 text-xs text-gray-400">{c.notes}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {subs.map((s) => (
                  <SubCategoryPill key={s} category={c.name} name={s} count={usage[`${c.name} ${s}`] ?? 0} />
                ))}
                <AddSubCategoryForm category={c.name} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
