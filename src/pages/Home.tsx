import React from 'react';
import { Hero } from '@/components/Hero';
import { Features } from '@/components/Features';
import { Process } from '@/components/Process';
import { Benefits } from '@/components/Benefits';
import { Stakeholders } from '@/components/Stakeholders';

const HomePage = () => {
  const featuresRef = React.useRef<HTMLDivElement>(null);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <Hero onScrollToFeatures={scrollToFeatures} />
      <div ref={featuresRef}>
        <Features />
      </div>
      <Process />
      <Benefits />
      <Stakeholders />
    </>
  );
};

export default HomePage;