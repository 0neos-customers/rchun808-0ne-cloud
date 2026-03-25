export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <a href="/" className="flex items-baseline gap-0.5 text-xl font-semibold tracking-tight">
          <span className="italic text-[var(--color-orange)]" style={{ fontFamily: "var(--font-heading), Georgia, serif" }}>O</span>
          <span>ne</span>
          <span className="ml-1.5 text-[var(--color-muted)] font-normal">OS</span>
        </a>
        <a
          href="/install"
          className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-charcoal)] transition-colors"
        >
          Session Prep
        </a>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-3xl mx-auto">
        <div className="mb-8">
          <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-[var(--color-orange)]/10 text-[var(--color-orange)] tracking-wide uppercase">
            Personal AI Infrastructure
          </span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
          Stop chatting.
          <br />
          <span className="text-[var(--color-orange)]">Start building.</span>
        </h1>

        <p className="text-lg text-[var(--color-muted)] max-w-xl mb-10 leading-relaxed">
          You&apos;re paying for the most powerful technology in history — and
          using it like a search engine. 0ne is an AI system that actually
          remembers your business, learns your voice, and builds things.
          Not a chatbox. A system.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href="/install"
            className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-[var(--color-orange)] rounded-md hover:bg-[var(--color-orange-dark)] transition-colors"
          >
            Get Started
          </a>
          <a
            href="#features"
            className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-[var(--color-charcoal)] bg-[var(--color-card)] rounded-md border border-[var(--color-border)] hover:border-[var(--color-charcoal)]/20 transition-colors card-shadow"
          >
            See What&apos;s Inside
          </a>
        </div>
      </main>

      {/* Features */}
      <section id="features" className="px-6 py-24 max-w-5xl mx-auto w-full">
        <h2 className="text-3xl font-bold text-center mb-16">
          ChatGPT is a calculator.{" "}
          <span className="text-[var(--color-muted)]">
            This is a computer.
          </span>
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          <Feature
            title="It Knows Your Business"
            description="Not generic responses — YOUR voice, YOUR context, YOUR goals. It gets smarter about you every time you use it."
          />
          <Feature
            title="Talk From Anywhere"
            description="Text it from your phone. Voice note it from the car. Message it in Slack. It's wherever you are."
          />
          <Feature
            title="It Actually Builds Things"
            description="Emails, documents, workflows, systems — things that used to require a developer or a marketing hire. You say it, it ships it."
          />
          <Feature
            title="One System, Whole Business"
            description="Marketing, sales, operations — organized in one place. Not another tab to forget about."
          />
          <Feature
            title="Your Files, Your Devices"
            description="Everything syncs to your phone through Obsidian. Edit, review, and access your AI's work from anywhere."
          />
          <Feature
            title="Installed in One Session"
            description="You don't need to be technical. You need a laptop and an internet connection. We handle the rest."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto bg-[var(--color-dark)] rounded-xl p-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            See what&apos;s actually possible.
          </h2>
          <p className="text-white/50 mb-8" style={{ fontFamily: "var(--font-body)" }}>
            60 minutes. One call. You&apos;ll leave with AI installed on your
            computer and wondering why you waited so long.
          </p>
          <a
            href="/install"
            className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-[var(--color-orange)] rounded-md hover:bg-[var(--color-orange-dark)] transition-colors"
          >
            Session Prep →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-sm text-[var(--color-muted)]">
        <p className="mb-2 flex items-baseline justify-center gap-0.5">
          <span className="italic text-[var(--color-orange)]" style={{ fontFamily: "var(--font-heading), Georgia, serif" }}>O</span>
          <span className="font-medium">ne</span>
          <span className="ml-1 font-normal">OS</span>
        </p>
        <a href="/privacy" className="hover:text-[var(--color-charcoal)] transition-colors">
          Privacy Policy
        </a>
      </footer>
    </div>
  );
}

function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-lg bg-[var(--color-card)] border border-[var(--color-border)] card-shadow">
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-[var(--color-muted)] leading-relaxed">
        {description}
      </p>
    </div>
  );
}
