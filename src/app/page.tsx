import Image from "next/image";
import { ProjectIntakeForm } from "@/components/project-intake";

/* ─── Icon Components ─── */

function SunRayDecor({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {Array.from({ length: 24 }).map((_, i) => (
        <line
          key={i}
          x1="100"
          y1="100"
          x2={100 + 95 * Math.cos((i * 15 * Math.PI) / 180)}
          y2={100 + 95 * Math.sin((i * 15 * Math.PI) / 180)}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.15"
        />
      ))}
    </svg>
  );
}

/* ─── Data ─── */

const portfolio = [
  {
    name: "Sunrise Bakery",
    url: "https://sunrisebakeryny.com",
    desc: "Local bakery in New York — warm, inviting design showcasing fresh baked goods.",
  },
  {
    name: "Please Fix It For Me",
    url: "https://pleasefixitforme.com",
    desc: "Handyman services for Miguel — clean, trustworthy layout that drives phone calls.",
  },
  {
    name: "Andrey the Carpenter",
    url: "https://andrey-the-carpenter.pages.dev",
    desc: "30+ years of master craftsmanship in Connecticut — custom woodwork, built-ins, and historic home restoration. Andrey is also our friend.",
  },
];

/* ─── Page ─── */

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      {/* ─── Navigation ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-warm-black/80 backdrop-blur-md border-b border-orange/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/zontak-logo.svg"
              alt="Zontak Logo"
              width={44}
              height={44}
              priority
            />
            <span className="text-xl font-bold tracking-tight">
              <span className="text-orange">ZON</span>
              <span className="text-blue">TAK</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-foreground/70">
            <a href="#services" className="hover:text-orange transition-colors">Services</a>
            <a href="#portfolio" className="hover:text-orange transition-colors">Portfolio</a>
            <a href="#pricing" className="hover:text-orange transition-colors">Pricing</a>
            <a href="#pay" className="hover:text-orange transition-colors">Pay</a>
            <a href="#contact" className="hover:text-orange transition-colors">Contact</a>
          </div>
          <a
            href="#contact"
            className="bg-orange hover:bg-orange-dark text-warm-black font-semibold px-5 py-2 rounded-full text-sm transition-colors"
          >
            Get Started
          </a>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        {/* Background sun rays */}
        <div className="absolute inset-0 overflow-hidden">
          <SunRayDecor className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] text-orange animate-rotate-slow" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-orange/5 blur-3xl animate-pulse-glow" />
          <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full bg-blue/5 blur-3xl animate-pulse-glow" style={{ animationDelay: "2s" }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <div className="animate-float mb-8">
            <Image
              src="/zontak-logo.svg"
              alt="Zontak"
              width={180}
              height={180}
              priority
              className="mx-auto"
            />
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="text-gradient-sun">One-Page App</span>
            <br />
            <span className="text-foreground">Websites</span>
          </h1>

          <p className="text-xl md:text-2xl text-foreground/60 mb-4 font-light">
            Full service: <span className="text-orange">build</span> &middot;{" "}
            <span className="text-blue">deploy</span> &middot;{" "}
            <span className="text-gold">maintain</span>
          </p>

          <div className="mt-10 mb-12">
            <div className="inline-flex items-baseline gap-1 bg-warm-gray/60 border border-orange/20 rounded-2xl px-8 py-4">
              <span className="text-5xl md:text-6xl font-bold text-gradient-sun">$100</span>
              <span className="text-xl text-foreground/50">/year</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#contact"
              className="bg-orange hover:bg-orange-dark text-warm-black font-bold px-8 py-4 rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-orange/20"
            >
              Start Your Project
            </a>
            <a
              href="#portfolio"
              className="border border-foreground/20 hover:border-orange/50 text-foreground font-medium px-8 py-4 rounded-full text-lg transition-all hover:scale-105"
            >
              View Our Work
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-foreground/30">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-foreground/30 to-transparent" />
        </div>
      </section>

      {/* ─── Divider ─── */}
      <div className="divider-sun" />

      {/* ─── Services ─── */}
      <section id="services" className="relative py-32 px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-warm-black via-background to-warm-black opacity-50" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <p className="text-orange uppercase tracking-[0.3em] text-sm font-medium mb-4">What We Do</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-8">
            <span className="text-foreground">AI-First </span>
            <span className="text-gradient-blue">Creative Company</span>
          </h2>
          <p className="text-lg text-foreground/60 max-w-2xl mx-auto mb-16 leading-relaxed">
            We build beautiful, fast single-page applications for small businesses.
            You describe your project — our AI-powered workflow delivers a
            production-ready site deployed on Cloudflare. No templates. No bloat.
            Just your business, online.
          </p>

          {/* Process steps */}
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Describe", text: "Fill out our project intake form with your business details and style preferences." },
              { step: "02", title: "Build", text: "We design and develop your one-page app with AI-first tooling." },
              { step: "03", title: "Launch", text: "Deployed to Cloudflare with your custom domain, SSL, and hosting." },
            ].map((item) => (
              <div key={item.step} className="group relative p-8 rounded-2xl border border-orange/10 bg-warm-gray/30 hover:border-orange/30 transition-all">
                <div className="text-5xl font-bold text-orange/10 group-hover:text-orange/20 transition-colors mb-4">{item.step}</div>
                <h3 className="text-xl font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-foreground/50 text-sm leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Divider ─── */}
      <div className="divider-sun" />

      {/* ─── Portfolio ─── */}
      <section id="portfolio" className="relative py-32 px-6">
        <div className="absolute inset-0 overflow-hidden">
          <SunRayDecor className="absolute bottom-0 left-0 w-[800px] h-[800px] text-orange opacity-30" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange uppercase tracking-[0.3em] text-sm font-medium mb-4">Our Work</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Sites We&apos;ve <span className="text-gradient-sun">Built</span>
            </h2>
            <p className="text-foreground/50 text-lg">When we build a site for you, we become friends.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {portfolio.map((p) => (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block p-8 rounded-2xl border border-orange/10 bg-warm-gray/20 hover:border-orange/40 hover:bg-warm-gray/40 transition-all"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full bg-orange group-hover:animate-pulse" />
                  <h3 className="text-xl font-bold text-foreground group-hover:text-orange transition-colors">
                    {p.name}
                  </h3>
                </div>
                <p className="text-foreground/50 text-sm leading-relaxed mb-4">{p.desc}</p>
                <span className="text-blue text-sm font-mono group-hover:underline">
                  {p.url.replace("https://", "")} &rarr;
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Divider ─── */}
      <div className="divider-sun" />

      {/* ─── Pricing CTA ─── */}
      <section id="pricing" className="relative py-32 px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-warm-gray/20 to-background" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="inline-block rounded-full bg-orange/10 border border-orange/20 px-4 py-1 text-orange text-sm font-medium mb-8">
            Simple Pricing
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="text-gradient-sun">$100</span>
            <span className="text-foreground/40">/year</span>
          </h2>
          <p className="text-foreground/60 text-lg mb-2">That&apos;s less than $9/month for a complete web presence.</p>
          <p className="text-foreground/40 text-sm mb-12">Build + deploy + hosting + SSL + maintenance. Everything.</p>

          <div className="bg-warm-gray/40 border border-orange/15 rounded-3xl p-8 md:p-12 text-left">
            <ul className="space-y-4">
              {[
                "Custom one-page app — not a template",
                "Deployed on Cloudflare edge network",
                "Your own custom domain",
                "SSL certificate included",
                "Mobile-first responsive design",
                "Basic SEO optimization",
                "Contact form integration",
                "Ongoing maintenance & updates",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-orange mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-foreground/70">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ─── Divider ─── */}
      <div className="divider-sun" />

      {/* ─── Payment ─── */}
      <section id="pay" className="relative py-32 px-6">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue/5 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <p className="text-orange uppercase tracking-[0.3em] text-sm font-medium mb-4">Payment</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Pay for Your <span className="text-gradient-sun">Site</span>
          </h2>
          <p className="text-foreground/50 text-lg mb-12">Choose your preferred payment method.</p>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Email / Invoice */}
            <a
              href="mailto:getaonepageapp@gmail.com?subject=Payment%20for%20One-Page%20App"
              className="group p-8 rounded-2xl border border-orange/15 bg-warm-gray/30 hover:border-orange/40 hover:bg-warm-gray/50 transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-orange/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-foreground group-hover:text-orange transition-colors">Email Invoice</h3>
              </div>
              <p className="text-foreground/50 text-sm leading-relaxed mb-4">
                Request an invoice via email. We accept bank transfer, Zelle, and other traditional methods.
              </p>
              <span className="text-orange text-sm font-medium">Send request &rarr;</span>
            </a>

            {/* Pay with Crypto */}
            <a
              href="https://commerce.coinbase.com/checkout/4ab87ce4-d5eb-4783-b5fa-83fd117c137e"
              target="_blank"
              rel="noopener noreferrer"
              className="group p-8 rounded-2xl border border-blue/15 bg-warm-gray/30 hover:border-blue/40 hover:bg-warm-gray/50 transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 1.5c4.694 0 8.5 3.806 8.5 8.5s-3.806 8.5-8.5 8.5S3.5 16.694 3.5 12 7.306 3.5 12 3.5zm-.5 4v1.05A3.001 3.001 0 009 11.5c0 1.398.956 2.573 2.25 2.905V16.5H10v1.5h1.5v1h1v-1H14v-1.5h-1.25v-2.095A3.001 3.001 0 0015 11.5c0-1.398-.956-2.573-2.25-2.905V6.5H14V5h-1.5V4h-1v1.5H10V7h1.5v1.05zm0 2.05c-.828 0-1.5.672-1.5 1.5s.672 1.5 1.5 1.5v-3zm1 0v3c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-foreground group-hover:text-blue transition-colors">Pay with Crypto</h3>
              </div>
              <p className="text-foreground/50 text-sm leading-relaxed mb-4">
                Pay with Bitcoin, Ethereum, USDC, or other cryptocurrencies via Coinbase Commerce.
              </p>
              <span className="text-blue text-sm font-medium">Pay now &rarr;</span>
            </a>
          </div>

          <p className="text-foreground/20 text-xs mt-8">
            Crypto payments powered by Coinbase Commerce &middot; Secure &amp; instant
          </p>
        </div>
      </section>

      {/* ─── Divider ─── */}
      <div className="divider-sun" />

      {/* ─── Contact / Project Intake ─── */}
      <ProjectIntakeForm />

      {/* ─── Footer ─── */}
      <footer className="border-t border-orange/10 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/zontak-logo.svg"
              alt="Zontak"
              width={32}
              height={32}
            />
            <span className="font-semibold text-sm">
              <span className="text-orange">ZON</span>
              <span className="text-blue">TAK</span>
              <span className="text-foreground/30 ml-2">AI First Creative Company</span>
            </span>
          </div>
          <p className="text-foreground/30 text-sm">
            &copy; {new Date().getFullYear()} Zontak LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
