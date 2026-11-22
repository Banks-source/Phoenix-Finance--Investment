import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  fetchTransactions,
  fetchAllTransactions,
  fetchCategoryTotals,
  fetchUnreviewedSummary,
  Txn,
} from "@/lib/queries";
import { fetchCategoryBudgets, fetchMonthSpendByCategory, fetchYtdAverageByCategory, setCategoryBudget } from "@/lib/budgets";
import { fetchBalanceSummary } from "@/lib/balances";
import { fetchAllSubCategoryNames } from "@/lib/subCategoriesTable";
import { applyReviewEdit } from "@/lib/reviewEdit";
import { payeeKey } from "@/lib/payeeKey";
import { parseBasis } from "@/lib/basis";
import { CATEGORIES } from "@/lib/taxonomy";
import { EXPENSE_TYPES } from "@/lib/fy";
import { accountName, AccountRef } from "@/lib/transferAccounts";
import type { McpScope } from "@/lib/mcpAuth";

const round = (n: number) => Math.round(n * 100) / 100;
const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
type ToolOut = { content: { type: "text"; text: string }[]; isError?: boolean };
const failure = (message: string): ToolOut => ({ content: [{ type: "text", text: message }], isError: true });

const basisField = z
  .enum(["all", "confirmed"])
  .optional()
  .describe('"all" (default) = approved + still-in-review; "confirmed" = approved only');

async function accountNames(): Promise<Record<string, string>> {
  const { data } = await createServiceClient().from("accounts").select("id, institution, account_label, account_number_masked");
  const out: Record<string, string> = {};
  for (const a of (data ?? []) as AccountRef[]) out[a.id] = accountName(a) ?? "";
  return out;
}

function brief(t: Txn, names: Record<string, string>) {
  return {
    id: t.id,
    date: t.date,
    amount: round(Number(t.amount)),
    owner: t.owner,
    account: t.account_id ? names[t.account_id] ?? null : null,
    merchant: t.merchant,
    description: t.detail,
    category: t.category,
    sub_category: t.sub_category,
    status: t.status,
    ...(t.review_reason ? { review_reason: t.review_reason } : {}),
    ...(t.categorised_by === "claude" ? { suggested_by_claude: true } : {}),
  };
}

/** Registers the Phoenix tools. Write tools exist only on a write-scoped server. */
export function registerPhoenixTools(server: McpServer, scope: McpScope, log: (tool: string, args: unknown) => void = () => {}) {
  const tool = <S extends z.ZodRawShape>(
    name: string,
    title: string,
    description: string,
    inputSchema: S,
    run: (args: z.infer<z.ZodObject<S>>) => Promise<ToolOut>
  ) =>
    server.registerTool(name, { title, description, inputSchema }, (async (args: any) => {
      log(name, args);
      try {
        return await run(args);
      } catch (e) {
        return failure(e instanceof Error ? e.message : String(e));
      }
    }) as any);

  // ---- read ---------------------------------------------------------------

  tool(
    "budget_status",
    "Budget vs actual",
    "Budget vs actual spend for a month, per category, with what's left and the % used. Includes transactions still in review unless basis=confirmed, and says how much of the total is unreviewed. Defaults to the current month.",
    {
      year: z.number().int().optional(),
      month: z.number().int().min(1).max(12).optional().describe("1-12"),
      basis: basisField,
    },
    async (a) => {
      const now = new Date();
      const year = a.year ?? now.getFullYear();
      const month = a.month ?? now.getMonth() + 1;
      const basis = parseBasis(a.basis);
      const from = `${year}-${String(month).padStart(2, "0")}-01`;
      const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      const [targets, spend, averages, unreviewed] = await Promise.all([
        fetchCategoryBudgets(),
        fetchMonthSpendByCategory(year, month, basis),
        fetchYtdAverageByCategory(year, basis),
        fetchUnreviewedSummary({ kind: "custom", from, to }),
      ]);
      const rows = CATEGORIES.filter((c) => (EXPENSE_TYPES as string[]).includes(c.type))
        .map((c) => {
          const target = targets[c.name] ?? averages[c.name] ?? 0;
          const spent = spend[c.name] ?? 0;
          return {
            category: c.name,
            budget: round(target),
            budget_is_default: targets[c.name] === undefined,
            spent: round(spent),
            remaining: round(target - spent),
            percent_used: target > 0 ? Math.round((spent / target) * 100) : null,
          };
        })
        .filter((r) => r.budget > 0 || r.spent > 0)
        .sort((x, y) => y.spent - x.spent);
      return text({
        month: `${year}-${String(month).padStart(2, "0")}`,
        basis,
        totals: {
          budget: round(rows.reduce((s, r) => s + r.budget, 0)),
          spent: round(rows.reduce((s, r) => s + r.spent, 0)),
        },
        unreviewed: { transactions: unreviewed.count, spending_in_them: round(unreviewed.expense), still_need_a_category: unreviewed.needsCategory },
        categories: rows,
      });
    }
  );

  tool(
    "spend_by_category",
    "Spend by category",
    "Net amount per category over a date range (negative = money out). Includes unreviewed transactions unless basis=confirmed.",
    { from: z.string().describe("ISO date, inclusive"), to: z.string().describe("ISO date, inclusive"), basis: basisField },
    async (a) => {
      const rows = await fetchCategoryTotals({ kind: "custom", from: a.from, to: a.to }, parseBasis(a.basis));
      return text(rows.map((r) => ({ category: r.category, type: r.type, net: round(r.net), transactions: r.count })));
    }
  );

  tool(
    "search_transactions",
    "Search transactions",
    "Transaction line items, newest first. Filter by date range, text in the merchant/description, category, sub-category, owner or status. Max 200 rows.",
    {
      from: z.string().optional(),
      to: z.string().optional(),
      text: z.string().optional().describe("matches merchant or description"),
      category: z.string().optional(),
      sub_category: z.string().optional(),
      owner: z.enum(["lloyd", "milani", "joint"]).optional(),
      status: z.enum(["approved", "pending_review"]).optional(),
      limit: z.number().int().min(1).max(200).optional().describe("default 50"),
    },
    async (a) => {
      const period = a.from && a.to ? ({ kind: "custom", from: a.from, to: a.to } as const) : undefined;
      const [{ rows, count }, names] = await Promise.all([
        fetchTransactions({
          period,
          status: a.status,
          search: a.text,
          owner: a.owner,
          category: a.category,
          sub_category: a.sub_category,
          limit: a.limit ?? 50,
        }),
        accountNames(),
      ]);
      const filteredByDate = period ? rows : rows.filter((r) => (!a.from || r.date >= a.from) && (!a.to || r.date <= a.to));
      return text({ matching: count, returned: filteredByDate.length, transactions: filteredByDate.map((t) => brief(t, names)) });
    }
  );

  tool(
    "review_queue",
    "Review queue",
    "What is waiting for approval: how many, a count per category, and the newest items (with the reason they were flagged and whether Claude suggested the category). Use the ids with categorise_transactions / approve_transactions.",
    {
      category: z.string().optional().describe("only this category"),
      limit: z.number().int().min(1).max(100).optional().describe("default 25"),
    },
    async (a) => {
      const [{ rows }, names] = await Promise.all([fetchAllTransactions({ status: "pending_review" }), accountNames()]);
      const byCategory = new Map<string, number>();
      for (const r of rows) byCategory.set(r.category ?? "Uncategorised", (byCategory.get(r.category ?? "Uncategorised") ?? 0) + 1);
      const shown = rows.filter((r) => !a.category || r.category === a.category).slice(0, a.limit ?? 25);
      return text({
        total: rows.length,
        by_category: [...byCategory.entries()].sort((x, y) => y[1] - x[1]).map(([category, count]) => ({ category, count })),
        items: shown.map((t) => brief(t, names)),
      });
    }
  );

  tool("account_balances", "Account balances", "Live balances for every linked bank account, plus total cash and debt.", {}, async () => {
    const b = await fetchBalanceSummary();
    return text({
      cash: round(b.cash),
      debt_owed: round(b.debt),
      net: round(b.net),
      as_of: b.observedAt,
      accounts: b.accounts.map((a) => ({
        name: `${a.institution} ${a.label}`,
        masked: a.masked,
        owner: a.owner,
        balance: round(a.current),
        available: a.available === null ? null : round(a.available),
      })),
    });
  });

  tool("list_categories", "List categories", "The category list (with type) and every sub-category name — use these exact names when categorising.", {}, async () =>
    text({ categories: CATEGORIES.map((c) => ({ name: c.name, type: c.type })), sub_categories: await fetchAllSubCategoryNames() })
  );

  tool(
    "memory_lookup",
    "What I've learned about a payee",
    "Looks up the categorisation memory for a payee name or description (e.g. 'Coles', 'Transfer To R LEE').",
    { payee: z.string() },
    async (a) => {
      const key = payeeKey(a.payee, a.payee);
      if (!key) return text({ key: "", rules: [] });
      const { data } = await createServiceClient()
        .from("merchant_rules")
        .select("merchant_pattern, category, sub_category, source, match_count, sample")
        .ilike("merchant_pattern", `%${key}%`)
        .limit(20);
      return text({ key, rules: data ?? [] });
    }
  );

  if (scope !== "write") return;

  // ---- write (separate token) --------------------------------------------

  const validCategory = (c: string) => CATEGORIES.some((x) => x.name === c);

  tool(
    "categorise_transactions",
    "Categorise transactions",
    "Set the category (and optionally sub-category) on transactions by id. The change is remembered for that payee and applied to its other unreviewed transactions. Rows stay in the review queue unless approve=true.",
    {
      ids: z.array(z.string()).min(1).max(200),
      category: z.string(),
      sub_category: z.string().nullable().optional(),
      approve: z.boolean().optional().describe("also mark them reviewed (default false)"),
    },
    async (a) => {
      if (!validCategory(a.category)) return failure(`Unknown category "${a.category}". Call list_categories for the valid names.`);
      const r = await applyReviewEdit({
        ids: a.ids,
        category: a.category,
        sub_category: a.sub_category ?? null,
        ...(a.approve ? { status: "approved" as const } : { keepStatus: true }),
      });
      return r.ok ? text({ updated: r.updated, rules_learned: r.learned, similar_unreviewed_also_updated: r.alsoUpdated }) : failure(r.error);
    }
  );

  tool(
    "approve_transactions",
    "Approve transactions",
    "Mark transactions (by id) as reviewed, keeping their current category. Approving is remembered as a confirmation of that category for the payee.",
    { ids: z.array(z.string()).min(1).max(200) },
    async (a) => {
      const r = await applyReviewEdit({ ids: a.ids, status: "approved" });
      return r.ok ? text({ approved: r.updated }) : failure(r.error);
    }
  );

  tool(
    "set_category_budget",
    "Set a monthly budget",
    "Set the monthly budget target for one category.",
    { category: z.string(), monthly_target: z.number().min(0) },
    async (a) => {
      if (!validCategory(a.category)) return failure(`Unknown category "${a.category}".`);
      const r = await setCategoryBudget(a.category, a.monthly_target);
      return r.error ? failure(r.error) : text({ category: a.category, monthly_target: a.monthly_target });
    }
  );
}
