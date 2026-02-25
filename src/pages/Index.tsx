import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { Benefits } from "@/components/Benefits";
import { Process } from "@/components/Process";
import { Stakeholders } from "@/components/Stakeholders";
import { Footer } from "@/components/Footer";
// import ScrollToTopAndPlatformButton from "@/components/ScrollToTopAndPlatformButton"; // Importar o novo componente

const Index = () => {
  const handleScrollToFeatures = () => {
    const featuresSection = document.getElementById('features-section');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Hero onScrollToFeatures={handleScrollToFeatures} /> {/* Passando a função como prop */}
      <Features />
      <Process />
      <Benefits />
      <Stakeholders />
      <Footer />
      {/* <ScrollToTopAndPlatformButton /> */} {/* Adicionar o botão aqui */}
    </div>
  );
};

export default Index;