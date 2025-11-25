import { useRef } from "react";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { Footer } from "@/components/Footer";

const Index = () => {
  const featuresRef = useRef<HTMLDivElement>(null);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Hero onScrollToFeatures={scrollToFeatures} />
      <div ref={featuresRef}>
        <Features />
      </div>
      <Footer />
    </div>
  );
};

export default Index;