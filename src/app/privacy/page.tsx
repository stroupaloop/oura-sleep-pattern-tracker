export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: March 2026</p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What We Collect</h2>
        <p>
          This application collects sleep, readiness, and heart rate data from
          your Oura Ring account via the Oura API. We also store your email
          address for authentication purposes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">How We Use Your Data</h2>
        <p>
          Your data is used solely to generate sleep trend analysis and pattern
          detection for your personal use. We do not sell, share, or distribute
          your data to any third parties.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Data Storage</h2>
        <p>
          Your data is stored in a secure database. OAuth tokens from Oura are
          encrypted at rest. Only authorized users (you and designated
          viewers) can access the dashboard.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Data Deletion</h2>
        <p>
          You may request deletion of all your data at any time by contacting
          the application administrator. You can also revoke API access through
          your Oura account settings.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p>
          For privacy-related inquiries, please contact the application
          administrator.
        </p>
      </section>
    </div>
  );
}
