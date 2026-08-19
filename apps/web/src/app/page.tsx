import { RedirectIfAuthed } from "@/components/auth/RedirectIfAuthed";
import { CtaBanner } from "@/components/landing/CtaBanner";
import { Faq } from "@/components/landing/Faq";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { Reveal } from "@/components/landing/Reveal";
import { StyleShowcase } from "@/components/landing/StyleShowcase";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <RedirectIfAuthed to="/app" />
      <Header />
      <main className="flex-1">
        <Hero />
        <Reveal>
          <HowItWorks />
        </Reveal>
        <Reveal>
          <StyleShowcase />
        </Reveal>
        <Reveal>
          <Features />
        </Reveal>
        <Reveal>
          <Pricing />
        </Reveal>
        <Reveal>
          <Faq />
        </Reveal>
        <Reveal>
          <CtaBanner />
        </Reveal>
      </main>
      <Footer />
    </div>
  );
}
