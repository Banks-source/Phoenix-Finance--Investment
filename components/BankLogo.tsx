// Bank logo tile. Falls back to the institution's initials when Redbark has
// no logo (or the migration that stores it hasn't run yet).
export default function BankLogo({ logo, institution, size = 32 }: { logo: string | null; institution: string; size?: number }) {
  const box = { width: size, height: size };
  if (!logo) {
    return (
      <span className="grid shrink-0 place-items-center rounded-lg bg-gray-100 text-[10px] font-semibold text-gray-500" style={box}>
        {institution.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-lg border border-gray-100 bg-white" style={box}>
      {/* Plain <img>: logos are third-party bank URLs, not worth wiring into next/image domains. */}
      <img src={logo} alt={institution} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain p-1" />
    </span>
  );
}
