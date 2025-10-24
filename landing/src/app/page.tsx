import { Hero } from "../components/Hero";
import { HowItWorks } from "../components/HowItWorks";
import { Footer } from "../components/Footer";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center">
      {/* Hero Section */}
      <Hero />

      {/* How It Works Section */}
      <HowItWorks />

      {/* Footer */}
      <Footer />
    </main>
  );
}
