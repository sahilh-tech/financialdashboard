type WarningBannerProps = {
  warnings: string[];
};

export function WarningBanner({ warnings }: WarningBannerProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-warning/60 bg-warning/10 p-4">
      <p className="text-sm font-semibold text-warningLight">Data warnings</p>
      <ul className="mt-2 space-y-1 text-sm text-uiTextPrimary">
        {warnings.map((warning) => (
          <li key={warning}>• {warning}</li>
        ))}
      </ul>
    </section>
  );
}
