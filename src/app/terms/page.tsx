export default function TermsOfService() {
  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: March 2026</p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Acceptance of Terms</h2>
        <p>
          By accessing this application, you agree to these terms of service.
          This is a personal health tracking tool with restricted access.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Not Medical Advice</h2>
        <p>
          This application is not a medical device. It does not diagnose,
          treat, or prevent any medical condition. The sleep pattern analysis
          provided is for personal awareness only. Always consult your
          healthcare provider regarding any health concerns.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Data Accuracy</h2>
        <p>
          Sleep data is sourced from the Oura Ring API. We make no guarantees
          about the accuracy or completeness of the data or the analysis
          derived from it.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Access</h2>
        <p>
          Access to this application is restricted to authorized users only.
          Unauthorized access attempts are prohibited.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Limitation of Liability</h2>
        <p>
          This application is provided &quot;as is&quot; without warranties of
          any kind. The developers are not liable for any damages arising from
          the use of this application or reliance on its analysis.
        </p>
      </section>
    </div>
  );
}
