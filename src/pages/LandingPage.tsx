import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import ProfilesSection from '@/components/landing/ProfilesSection';
import AISection from '@/components/landing/AISection';
import BenefitsSection from '@/components/landing/BenefitsSection';
import IntegrationsSection from '@/components/landing/IntegrationsSection';
import SecuritySection from '@/components/landing/SecuritySection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import CTASection from '@/components/landing/CTASection';
import LandingFooter from '@/components/landing/LandingFooter';

const LandingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Set page metadata for SEO
    document.title = 'Rioh Host - Gestão Inteligente para Propriedades de Temporada';
    
    // Add meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Automatize a gestão de suas propriedades de temporada com inteligência artificial. Dashboard completo, controle financeiro, gestão de equipe e muito mais.');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Automatize a gestão de suas propriedades de temporada com inteligência artificial. Dashboard completo, controle financeiro, gestão de equipe e muito mais.';
      document.head.appendChild(meta);
    }

    // Add Open Graph tags
    const ogTags = [
      { property: 'og:title', content: 'Rioh Host - Gestão Inteligente para Propriedades' },
      { property: 'og:description', content: 'Automatize processos, maximize lucros e ofereça experiências excepcionais' },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: '/LOGO RIOH HOST.png' }
    ];

    ogTags.forEach(tag => {
      const existing = document.querySelector(`meta[property="${tag.property}"]`);
      if (existing) {
        existing.setAttribute('content', tag.content);
      } else {
        const meta = document.createElement('meta');
        meta.setAttribute('property', tag.property);
        meta.content = tag.content;
        document.head.appendChild(meta);
      }
    });
  }, []);

  // If user is logged in, show different CTA
  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <HeroSection onGetStarted={handleGetStarted} isLoggedIn={!!user} />
      <FeaturesSection />
      <ProfilesSection />
      <AISection />
      <BenefitsSection />
      <TestimonialsSection />
      <IntegrationsSection />
      <SecuritySection />
      <CTASection onGetStarted={handleGetStarted} isLoggedIn={!!user} />
      <LandingFooter />
    </div>
  );
};

export default LandingPage;