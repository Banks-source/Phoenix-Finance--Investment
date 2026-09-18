# Phoenix Finance — design system

A deliberately small one. The app is two people on a phone, so the goal is
"every new screen looks like the Overview," not a component library.

## Principles
- **Phone first.** Design at ~390px wide, then let it breathe on desktop. Tap targets ≥ 44px. The bottom tab bar is the primary nav on phones.
- **Number first.** Lead with the figure that answers the question (cash, spent vs budget), label second, detail on tap.
- **State in form, not just digits.** Progress bars and colour say "fine / watch it / over" before the reader parses a number.
- **Money is tabular.** Always `tabular` on amounts so columns align.

## Tokens (`app/globals.css`)
| Token | Use |
|---|---|
| `--brand` `#4f46e5` (indigo-600) | Primary actions, active nav, progress fill, the cash banner gradient |
| `--bg` / `--surface` / `--border` | Page ground, cards, hairlines |
| Emerald | Good / income / on target (`money-pos`) |
| Amber | Watch — 85%+ of budget, "to review" |
| Rose | Over / debt / negative (`money-neg`) |

Radius: cards `rounded-xl`, tiles/logos `rounded-lg`, pills/bars `rounded-full`.
Type: one family (system stack). Page title `text-xl sm:text-2xl semibold`; card title `.section-title`; micro-label `.label-caps`; hero number `text-3xl semibold tabular`.

## Shared classes
`.card` · `.section-title` · `.label-caps` · `.row-link` · `.money-pos` / `.money-neg` · `.btn` `.btn-primary` `.btn-ghost` · `.input` `.select`

## Shared components
`PageHeader`, `StatCard`, `EmptyState` (`components/ui.tsx`) · `BankLogo` · `BudgetTable` · `NetWorthTrend` (dependency-free SVG).

## Patterns to reuse
- **Hero card:** indigo gradient banner (label-caps → big number → one supporting line), rows beneath.
- **List card:** `.card divide-y divide-gray-100` with `.row-link` rows.
- **Progress:** 2–2.5px bar in `bg-gray-100`; fill indigo → amber ≥ 85% → rose > 100%.
- **Bank-app feed:** rows grouped under a day header (`Today`, `Yesterday`, `Monday 14 September`), amounts right-aligned, credits green.

## Not yet done
Older pages (Tax, Portfolio, Categories, Review queues) use the same `.card` base but haven't had a mobile pass — apply the patterns above page by page rather than restyling in bulk.
