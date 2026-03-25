"use client";


import { useState, useEffect, createContext, useContext } from "react";
import { SlackManifest, DownloadSlackIcon } from "./download-button";
import { TokenProvider, TokenField, TokenSummary, TokenDownload, OneDownloadSection } from "./token-collector";

// OS Context for toggle state
const OSContext = createContext<{
  os: "mac" | "windows";
  setOS: (os: "mac" | "windows") => void;
}>({ os: "mac", setOS: () => {} });

function useOS() {
  return useContext(OSContext);
}

function OSProvider({ children }: { children: React.ReactNode }) {
  const [os, setOSState] = useState<"mac" | "windows">("mac");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem("0ne-install-os");
    if (saved === "windows") {
      setOSState("windows");
    }
    setMounted(true);
  }, []);

  const setOS = (newOS: "mac" | "windows") => {
    setOSState(newOS);
    localStorage.setItem("0ne-install-os", newOS);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return <div className="min-h-screen" />;
  }

  return (
    <OSContext.Provider value={{ os, setOS }}>
      {children}
    </OSContext.Provider>
  );
}

function OSToggle() {
  const { os, setOS } = useOS();

  return (
    <div className="flex flex-col items-center gap-3 mb-8">
      <p className="text-sm font-medium text-[var(--color-charcoal)]">
        What computer are you using?
      </p>
      <div className="inline-flex rounded-xl bg-[var(--color-charcoal)]/5 p-1">
        <button
          onClick={() => setOS("mac")}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
            os === "mac"
              ? "bg-[var(--color-orange)] text-white shadow-sm"
              : "text-[var(--color-charcoal)] hover:text-[var(--color-orange)]"
          }`}
        >
          Mac
        </button>
        <button
          onClick={() => setOS("windows")}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
            os === "windows"
              ? "bg-[var(--color-orange)] text-white shadow-sm"
              : "text-[var(--color-charcoal)] hover:text-[var(--color-orange)]"
          }`}
        >
          Windows
        </button>
      </div>
    </div>
  );
}

function SystemRequirements() {
  const { os } = useOS();

  return (
    <section className="mb-12 p-6 rounded-2xl bg-[var(--color-charcoal)]/3 border border-[var(--color-charcoal)]/10">
      <h2 className="text-xl font-bold mb-2">System Requirements</h2>
      <p className="text-sm text-[var(--color-muted)] mb-4">
        Don&apos;t worry if this looks technical — <strong>we can do this together on the call</strong> if you prefer. But if you want to get a head start, here&apos;s what to check:
      </p>

      {os === "mac" ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-orange)] text-white text-xs flex items-center justify-center">1</span>
            <div>
              <p className="font-medium">macOS 13.0 (Ventura) or later</p>
              <p className="text-sm text-[var(--color-muted)]">
                Check: Apple menu → About This Mac
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-orange)] text-white text-xs flex items-center justify-center">2</span>
            <div>
              <p className="font-medium">Xcode Command Line Tools</p>
              <p className="text-sm text-[var(--color-muted)]">
                Open Terminal (search &quot;Terminal&quot; in Spotlight) and paste:
              </p>
              <code className="block mt-1 px-3 py-2 rounded bg-[var(--color-charcoal)]/5 text-xs font-mono">xcode-select --install</code>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                A popup will ask you to install — click Install and wait 5-10 minutes.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-orange)] text-white text-xs flex items-center justify-center">3</span>
            <div>
              <p className="font-medium">Homebrew (Mac package manager)</p>
              <p className="text-sm text-[var(--color-muted)]">
                In Terminal, paste this command (all one line):
              </p>
              <code className="block mt-1 px-3 py-2 rounded bg-[var(--color-charcoal)]/5 text-xs font-mono break-all">/bin/bash -c &quot;$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)&quot;</code>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                It will ask for your Mac password (you won&apos;t see characters as you type — that&apos;s normal). Takes 2-3 minutes.
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                <strong>Important:</strong> When it finishes, it shows two commands under &quot;Next steps&quot; — copy and run both. Then run:
              </p>
              <code className="block mt-1 px-3 py-2 rounded bg-[var(--color-charcoal)]/5 text-xs font-mono">eval &quot;$(/opt/homebrew/bin/brew shellenv)&quot;</code>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-[var(--color-orange)]/5 border border-[var(--color-orange)]/20">
            <p className="text-sm text-[var(--color-muted)]">
              <strong>That&apos;s it for prep!</strong> The installer handles everything else automatically (Node.js, Claude Code, Obsidian, and more).
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-orange)] text-white text-xs flex items-center justify-center">✓</span>
            <div>
              <p className="font-medium">Windows 10 (version 1809+) or Windows 11</p>
              <p className="text-sm text-[var(--color-muted)]">
                Check: Settings → System → About
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-orange)] text-white text-xs flex items-center justify-center">✓</span>
            <div>
              <p className="font-medium">Git for Windows</p>
              <p className="text-sm text-[var(--color-muted)]">
                <strong>Easy way:</strong> Download and run the installer from <a href="https://git-scm.com/downloads/win" target="_blank" rel="noopener noreferrer" className="text-[var(--color-orange)] hover:underline">git-scm.com/downloads/win</a>
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                Just click Next through all the options — the defaults are fine.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-orange)] text-white text-xs flex items-center justify-center">✓</span>
            <div>
              <p className="font-medium">winget (Windows Package Manager)</p>
              <p className="text-sm text-[var(--color-muted)]">
                <strong>Easy way:</strong> Search &quot;App Installer&quot; in the Microsoft Store and install it
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                Already installed on most Windows 10/11 computers.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function InstallPrep() {
  return (
    <OSProvider>
      <InstallPrepContent />
    </OSProvider>
  );
}

function InstallPrepContent() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto w-full">
        <a
          href="/"
          className="flex items-baseline gap-0.5 text-xl font-semibold tracking-tight"
        >
          <span className="italic text-[var(--color-orange)]" style={{ fontFamily: "var(--font-heading), Georgia, serif" }}>O</span>
          <span>ne</span>
          <span className="ml-1.5 text-[var(--color-muted)] font-normal">OS</span>
        </a>
        <span className="text-sm text-[var(--color-muted)]">Session Prep</span>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Before Your Session
          </h1>
          <p className="text-lg text-[var(--color-muted)]">
            A few quick things to set up before we hop on the call. You don&apos;t
            need to understand how any of this works — just follow the steps,
            save the tokens below, and I&apos;ll handle everything else when we
            meet.
          </p>
          <div className="mt-6 p-4 rounded-xl bg-[var(--color-orange)]/5 border border-[var(--color-orange)]/15">
            <p className="text-sm text-[var(--color-charcoal)]">
              <strong>Takes about 15 minutes.</strong> Each section walks you
              through creating a free account and copying a token. Save them in
              the fields as you go — they stay in your browser. <strong>Skip anything
              you&apos;re not sure about</strong> — we can do it together on the call.
            </p>
          </div>
        </div>

        {/* OS Toggle */}
        <OSToggle />

        {/* System Requirements */}
        <SystemRequirements />

        <TokenProvider>

        {/* Prerequisites */}
        <Section number="0" title="Claude Subscription">
          <p className="text-[var(--color-muted)] mb-6">
            This is the AI that powers everything. You&apos;ll need an active
            subscription before our session.
          </p>
          <a
            href="https://claude.com/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 rounded-xl bg-white border border-[var(--color-charcoal)]/5 hover:border-[var(--color-orange)]/30 transition-colors"
          >
            <p className="font-semibold mb-1">Claude Pro or Max</p>
            <p className="text-sm text-[var(--color-muted)]">
              Your AI subscription ($20-200/mo)
            </p>
            <p className="text-sm text-[var(--color-orange)] mt-2">
              claude.com/pricing →
            </p>
          </a>
          <p className="text-sm text-[var(--color-muted)] mt-4">
            If you already have a Claude account, you&apos;re good. If not,
            sign up for Pro ($20/mo) — you can easily upgrade later if you
            need to.
          </p>
        </Section>

        {/* Cloud Sync */}
        <Section number="1" title="Cloud Sync">
          <p className="text-[var(--color-muted)] mb-6">
            This lets you access your AI files from your phone. Pick the one
            that matches your phone — if you&apos;re not sure, we&apos;ll figure
            it out on the call.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <SyncOption
              name="iCloud Drive"
              tag="iPhone users"
              description="Already on your Mac. Just make sure iCloud Drive is turned on in System Settings."
            />
            <SyncOption
              name="Google Drive"
              tag="Android users"
              description="Download the Google Drive desktop app if you don't have it."
            />
          </div>
          <p className="text-sm text-[var(--color-muted)] mt-4">
            On a PC with an iPhone?{" "}
            <a
              href="https://apps.microsoft.com/detail/9pktq5699m62"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-orange)] hover:underline"
            >
              iCloud for Windows
            </a>{" "}
            works great.
          </p>
          <p className="text-sm text-[var(--color-muted)] mt-2">
            Not sure? Skip it for now — we can set this up together.
          </p>
        </Section>

        {/* Telegram */}
        <Section number="2" title="Telegram Bot">
          <p className="text-[var(--color-muted)] mb-6">
            This is how you&apos;ll talk to your AI from your phone — text
            messages, voice notes, photos, anything. It takes about 60 seconds.
            Do this part on your computer if you can — it&apos;ll make copying
            the token easier.
          </p>
          <Steps>
            <Step n={1}>
              Download Telegram if you don&apos;t have it:{" "}
              <a href="https://desktop.telegram.org" target="_blank" rel="noopener noreferrer" className="text-[var(--color-orange)] font-medium hover:underline">Desktop</a>
              {" / "}
              <a href="https://apps.apple.com/app/telegram-messenger/id686449807" target="_blank" rel="noopener noreferrer" className="text-[var(--color-orange)] font-medium hover:underline">iPhone</a>
              {" / "}
              <a href="https://play.google.com/store/apps/details?id=org.telegram.messenger" target="_blank" rel="noopener noreferrer" className="text-[var(--color-orange)] font-medium hover:underline">Android</a>
            </Step>
            <Step n={2}>
              Open Telegram and search for{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-orange)] font-medium hover:underline"
              >
                @BotFather
              </a>{" "}
              — this is Telegram&apos;s built-in tool for creating bots
            </Step>
            <Step n={3}>
              Send the message <Code>/newbot</Code>
            </Step>
            <Step n={4}>
              It&apos;ll ask for a name — type <Code>0ne</Code>
            </Step>
            <Step n={5}>
              It&apos;ll ask for a username (must end in <Code>bot</Code>). Pick any of these — just replace &quot;yourname&quot; with your actual name:
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-[var(--color-muted)]">
                <span><Code>yourname_one_bot</Code></span>
                <span><Code>yourname_ai_bot</Code></span>
                <span><Code>yourname_0ne_bot</Code></span>
                <span><Code>yourname_assistant_bot</Code></span>
                <span><Code>yourname_personal_bot</Code></span>
                <span><Code>yourname_hub_bot</Code></span>
                <span><Code>yourfirstlast_bot</Code></span>
                <span><Code>yourname_pro_bot</Code></span>
                <span><Code>yourname_cmd_bot</Code></span>
                <span><Code>yourname_ops_bot</Code></span>
              </div>
            </Step>
            <Step n={6}>
              BotFather will reply with a long token that looks like{" "}
              <Code>7123456789:AAF-abc123...</Code> — copy it and paste it below.
            </Step>
          </Steps>
          <TokenField id="telegram_bot_token" label="Telegram Bot Token" placeholder="7123456789:AAF-abc123..." />
        </Section>

        {/* Slack */}
        <Section number="3" title="Slack App">
          <p className="text-[var(--color-muted)] mb-6">
            This puts your AI right inside your Slack workspace. A bit more
            steps than Telegram, but we&apos;ve got a shortcut — a pre-made
            config you just copy and paste.
          </p>
          <p className="text-sm text-[var(--color-muted)] mb-6">
            Don&apos;t use Slack? Skip this section entirely.
          </p>

          <Steps>
            <Step n={1}>
              Go to{" "}
              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-orange)] font-medium hover:underline"
              >
                api.slack.com/apps
              </a>{" "}
              and sign in
            </Step>
            <Step n={2}>
              Click the green <strong>Create New App</strong> button →
              choose <strong>From an app manifest</strong>
            </Step>
            <Step n={3}>Pick your workspace from the dropdown</Step>
            <Step n={4}>
              You&apos;ll see a text box. Delete whatever&apos;s in there,
              then copy and paste this entire block:
            </Step>
          </Steps>
          <SlackManifest />
          <Steps>
            <Step n={5}>
              Click <strong>Next</strong>, review, then <strong>Create</strong>
            </Step>
            <Step n={6}>
              You&apos;re now on your app&apos;s page. Scroll down to{" "}
              <strong>App-Level Tokens</strong> → click{" "}
              <strong>Generate Token and Scopes</strong> → name it anything →
              add the scope <Code>connections:write</Code> →{" "}
              <strong>Generate</strong> → copy the token (starts with{" "}
              <Code>xapp-</Code>)
            </Step>
            <Step n={7}>
              In the left sidebar, click <strong>OAuth &amp; Permissions</strong>{" "}
              → click <strong>Install to Workspace</strong> → <strong>Allow</strong>{" "}
              → copy the <strong>Bot User OAuth Token</strong> (starts with{" "}
              <Code>xoxb-</Code>)
            </Step>
            <Step n={8}>
              Optional: give your bot an icon. <DownloadSlackIcon /> then go to{" "}
              <strong>Basic Information</strong> →{" "}
              <strong>Display Information</strong> → drag it onto the image
              area.
            </Step>
          </Steps>
          <TokenField id="slack_bot_token" label="Slack Bot Token" placeholder="xoxb-..." />
          <TokenField id="slack_app_token" label="Slack App Token" placeholder="xapp-..." />
          <div className="mt-4 p-3 rounded-lg bg-[var(--color-charcoal)]/3">
            <p className="text-sm text-[var(--color-muted)]">
              <strong>Slack User ID</strong> — Click your profile picture in
              Slack → Profile → the three dots menu →{" "}
              <strong>Copy member ID</strong>.
            </p>
          </div>
          <TokenField id="slack_user_id" label="Slack User ID" placeholder="U0123ABC456" />
        </Section>

        {/* Voice */}
        <Section number="4" title="Voice (Optional)">
          <p className="text-[var(--color-muted)] mb-6">
            Want to send voice messages to your AI and hear it talk back?
            These two services make that possible. Both are optional — we can
            always add them later.
          </p>

          <h3 className="font-semibold mb-1">
            Groq — Voice Transcription (Free)
          </h3>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            This lets your AI understand voice notes you send it.
          </p>
          <Steps>
            <Step n={1}>
              Go to{" "}
              <a
                href="https://console.groq.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-orange)] font-medium hover:underline"
              >
                console.groq.com
              </a>{" "}
              and create a free account
            </Step>
            <Step n={2}>
              Click <strong>API Keys</strong> in the sidebar → create a
              new key → copy it
            </Step>
          </Steps>
          <TokenField id="groq_api_key" label="Groq API Key" placeholder="gsk_..." />

          <h3 className="font-semibold mb-1 mt-10">
            ElevenLabs — Voice Responses (Free to start)
          </h3>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            This lets your AI respond with a realistic voice. The free plan
            gives you about 10 minutes of audio per month — enough to try it
            out. Paid plans start at $5/mo if you want more. Not required —
            your AI works great with text only.
          </p>
          <Steps>
            <Step n={1}>
              Go to{" "}
              <a
                href="https://elevenlabs.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-orange)] font-medium hover:underline"
              >
                elevenlabs.io
              </a>{" "}
              and create an account
            </Step>
            <Step n={2}>
              Click your profile icon → <strong>Profile + API key</strong> →
              copy your API key
            </Step>
          </Steps>
          <TokenField id="elevenlabs_api_key" label="ElevenLabs API Key" placeholder="sk_..." />
          <TokenField id="elevenlabs_voice_id" label="ElevenLabs Voice ID" placeholder="Voice ID (optional)" />
        </Section>

        {/* AI Services */}
        <Section number="5" title="AI Services (Optional)">
          <p className="text-[var(--color-muted)] mb-6">
            These power advanced features like video analysis, image generation,
            and deep research. Both have generous free tiers — skip any you&apos;re
            not sure about.
          </p>

          <h3 className="font-semibold mb-1">
            Google Gemini — Multimodal AI (Free)
          </h3>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Enables video understanding, image generation, and document analysis.
            The free tier is very generous for personal use.
          </p>
          <Steps>
            <Step n={1}>
              Go to{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-orange)] font-medium hover:underline"
              >
                aistudio.google.com/apikey
              </a>{" "}
              and sign in with Google
            </Step>
            <Step n={2}>
              Click <strong>Create API key</strong> → select any project (or
              create one) → copy the key
            </Step>
          </Steps>
          <TokenField id="gemini_api_key" label="Gemini API Key" placeholder="AIzaSy..." />

          <h3 className="font-semibold mb-1 mt-10">
            Perplexity — AI Research (Free to start)
          </h3>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Powers deep research and web-grounded answers. Free tier includes
            limited searches — paid plans start at $5/mo for more.
          </p>
          <Steps>
            <Step n={1}>
              Go to{" "}
              <a
                href="https://www.perplexity.ai/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-orange)] font-medium hover:underline"
              >
                perplexity.ai/settings/api
              </a>{" "}
              and sign in
            </Step>
            <Step n={2}>
              Click <strong>Generate</strong> under API Keys → copy the key
            </Step>
          </Steps>
          <TokenField id="perplexity_api_key" label="Perplexity API Key" placeholder="pplx-..." />
        </Section>

        {/* GoHighLevel */}
        <Section number="6" title="GoHighLevel (Optional)">
          <p className="text-[var(--color-muted)] mb-6">
            If you use GoHighLevel for CRM and automation, these let your AI
            manage contacts, send messages, trigger workflows, and more. Skip
            this if you don&apos;t use GHL.
          </p>

          <h3 className="font-semibold mb-1">Private Integration Token</h3>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            This gives your AI secure access to your GHL account.
          </p>
          <Steps>
            <Step n={1}>
              Log into{" "}
              <a
                href="https://app.gohighlevel.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-orange)] font-medium hover:underline"
              >
                GoHighLevel
              </a>
            </Step>
            <Step n={2}>
              Go to <strong>Settings</strong> (bottom left) →{" "}
              <strong>Integrations</strong> → <strong>Private Integrations</strong>
            </Step>
            <Step n={3}>
              Click <strong>Create Integration</strong> (or use an existing one)
              → copy the <strong>API Token</strong> (starts with{" "}
              <Code>pit-</Code>)
            </Step>
          </Steps>
          <TokenField id="ghl_private_integration_token" label="GHL Private Integration Token" placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />

          <h3 className="font-semibold mb-1 mt-10">Location ID</h3>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            This tells your AI which sub-account to work with.
          </p>
          <Steps>
            <Step n={1}>
              Navigate to your sub-account in GHL
            </Step>
            <Step n={2}>
              Look at the URL: <Code>app.gohighlevel.com/v2/location/<strong>XXXXXXXXXX</strong>/...</Code>
            </Step>
            <Step n={3}>
              Copy that <Code>XXXXXXXXXX</Code> part — that&apos;s your Location ID
            </Step>
          </Steps>
          <TokenField id="ghl_location_id" label="GHL Location ID" placeholder="XXXXXXXXXX" />
        </Section>

        {/* Apify */}
        <Section number="7" title="Apify (Optional)">
          <p className="text-[var(--color-muted)] mb-6">
            Apify lets your AI scrape data from the web — social media profiles,
            business listings, e-commerce sites, and more. The free tier includes
            $5/mo of usage. Skip this if you&apos;re not sure — you can always
            set it up later.
          </p>
          <Steps>
            <Step n={1}>
              Go to{" "}
              <a
                href="https://console.apify.com/sign-up"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-orange)] font-medium hover:underline"
              >
                console.apify.com
              </a>{" "}
              and create a free account
            </Step>
            <Step n={2}>
              Click your avatar → <strong>Settings</strong> →{" "}
              <strong>Integrations</strong> → copy your{" "}
              <strong>Personal API token</strong> (starts with{" "}
              <Code>apify_api_</Code>)
            </Step>
          </Steps>
          <TokenField id="apify_token" label="Apify API Token" placeholder="apify_api_..." />
        </Section>

        {/* Summary & Download */}
        <Section number="8" title="You're All Set">
          <p className="text-[var(--color-muted)] mb-6">
            That&apos;s everything. Here&apos;s a summary of what you&apos;ve
            collected. Download the file below and have it ready for our
            session — I&apos;ll tell you where to put it.
          </p>
          <TokenSummary />
          <TokenDownload />
          <OneDownloadSection />
          <p className="text-sm text-[var(--color-muted)] mt-6">
            Your tokens are saved in your browser only — nothing is sent
            anywhere. If you missed any, don&apos;t worry — we&apos;ll fill
            in the gaps together on the call.
          </p>
        </Section>

        </TokenProvider>

        {/* Bonus */}
        <section className="mb-16" id="bonus">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-charcoal)]/10 text-[var(--color-charcoal)] text-sm font-bold">
              +
            </span>
            <h2 className="text-2xl font-bold">Download These Apps</h2>
          </div>
          <p className="text-[var(--color-muted)] mb-6">
            If you have a few extra minutes, grab these on your phone.
            You&apos;ll use them after the install.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            <AppCard
              name="Claude"
              description="Chat with your AI on the go"
              links={[
                { label: "iPhone", href: "https://apps.apple.com/app/claude-by-anthropic/id6473753684" },
                { label: "Android", href: "https://play.google.com/store/apps/details?id=com.anthropic.claude" },
              ]}
            />
            <AppCard
              name="Obsidian"
              description="View and edit your files"
              links={[
                { label: "iPhone", href: "https://apps.apple.com/app/obsidian-connected-notes/id1557175442" },
                { label: "Android", href: "https://play.google.com/store/apps/details?id=md.obsidian" },
              ]}
            />
            <AppCard
              name="Telegram"
              description="Talk to your AI via text and voice"
              links={[
                { label: "iPhone", href: "https://apps.apple.com/app/telegram-messenger/id686449807" },
                { label: "Android", href: "https://play.google.com/store/apps/details?id=org.telegram.messenger" },
              ]}
            />
          </div>
        </section>

        {/* Back to top */}
        <div className="mt-16 pt-8 border-t border-[var(--color-charcoal)]/10 text-center">
          <a
            href="/"
            className="text-sm text-[var(--color-muted)] hover:text-[var(--color-charcoal)] transition-colors"
          >
            ← Back to One OS
          </a>
        </div>
      </main>
    </div>
  );
}

/* ── Components ─────────────────────────────────────────────────── */

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-16" id={`step-${number}`}>
      <div className="flex items-center gap-3 mb-6">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-orange)] text-white text-sm font-bold">
          {number}
        </span>
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-4 mb-6">{children}</ol>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-charcoal)]/5 text-xs font-semibold text-[var(--color-charcoal)]">
        {n}
      </span>
      <div className="text-[var(--color-charcoal)] leading-relaxed">
        {children}
      </div>
    </li>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-[var(--color-charcoal)]/5 text-sm font-mono">
      {children}
    </code>
  );
}

function SyncOption({
  name,
  tag,
  description,
}: {
  name: string;
  tag: string;
  description: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-white border border-[var(--color-charcoal)]/5">
      <div className="flex items-center gap-2 mb-1">
        <p className="font-semibold">{name}</p>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-orange)]/10 text-[var(--color-orange)]">
          {tag}
        </span>
      </div>
      <p className="text-sm text-[var(--color-muted)]">{description}</p>
    </div>
  );
}

function AppCard({
  name,
  description,
  links,
}: {
  name: string;
  description: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="p-4 rounded-xl bg-white border border-[var(--color-charcoal)]/5">
      <p className="font-semibold mb-1">{name}</p>
      <p className="text-sm text-[var(--color-muted)] mb-3">{description}</p>
      <div className="flex gap-3">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--color-orange)] font-medium hover:underline"
          >
            {l.label} →
          </a>
        ))}
      </div>
    </div>
  );
}
