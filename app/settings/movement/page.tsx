import { PageHeader } from "@/components/ui";
import MovementCheck from "@/components/MovementCheck";

export const dynamic = "force-dynamic";

export default function MovementPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Money movement"
        subtitle="Matches transfers between your CBA, NAB, ING and Westpac accounts so they never count as spending."
      />
      <div className="card space-y-1.5 p-4 text-sm text-gray-600">
        <p>Money that moves between your own accounts is filed as <b>Money Movement › Internal transfer</b>.</p>
        <p>A transfer to or from an account I don&apos;t recognise comes to <b>Review</b> for you to categorise — once, then it&apos;s remembered.</p>
        <p>Only interest and fees charged on the <b>ING loan</b> count as Investment cost; repayments into it are just transfers.</p>
      </div>
      <MovementCheck defaultSince={`${new Date().getFullYear()}-01-01`} />
    </div>
  );
}
