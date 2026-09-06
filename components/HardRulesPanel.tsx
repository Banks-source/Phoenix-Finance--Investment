import { RuleResult } from "@/lib/hardRules";
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";

const STATUS_STYLE: Record<RuleResult["status"], { icon: typeof CheckCircle2; color: string; label: string }> = {
  pass: { icon: CheckCircle2, color: "text-emerald-600", label: "Pass" },
  fail: { icon: XCircle, color: "text-rose-600", label: "Fail" },
  not_assessable: { icon: HelpCircle, color: "text-gray-400", label: "Not assessable" },
};

export default function HardRulesPanel({ rules }: { rules: RuleResult[] }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Hard rules</h2>
        <span className="text-xs text-gray-400">v{rules[0]?.version ?? 1} — continuously evaluated, not remembered</span>
      </div>
      <div className="divide-y divide-gray-100">
        {rules.map((r) => {
          const { icon: Icon, color, label } = STATUS_STYLE[r.status];
          return (
            <div key={r.rule} className="flex items-start gap-3 py-2.5 text-sm">
              <Icon size={16} className={`mt-0.5 shrink-0 ${color}`} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {r.rule}. {r.name}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">{r.reason}</div>
              </div>
              <span className={`shrink-0 text-xs font-medium ${color}`}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
