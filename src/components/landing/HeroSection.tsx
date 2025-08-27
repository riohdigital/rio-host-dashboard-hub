import { ChevronDown, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from '@/lib/motion';

interface HeroSectionProps {
  onGetStarted: () => void;
  isLoggedIn: boolean;
}

const HeroSection = ({ onGetStarted, isLoggedIn }: HeroSectionProps) => {
  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10">
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo Animation */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, type: "spring" }}
            className="mb-8 flex justify-center"
          >
            <img 
              src="/LOGO RIOH HOST.png" 
              alt="Rioh Host" 
              className="h-24 w-auto drop-shadow-2xl"
            />
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent"
          >
            Gestão Inteligente para
            <span className="block mt-2">Propriedades de Temporada</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto"
          >
            Automatize processos, maximize lucros e ofereça experiências excepcionais 
            com o poder da inteligência artificial
          </motion.p>

          {/* AI Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-8"
          >
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-sm font-medium">Powered by AI</span>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
          >
            <Button
              size="lg"
              onClick={onGetStarted}
              className="bg-gradient-primary hover:opacity-90 text-white font-semibold px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              {isLoggedIn ? 'Acessar Dashboard' : 'Começar Agora'}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="group border-2 px-8 py-6 text-lg font-semibold hover:bg-primary/5 transition-all duration-300"
            >
              <Play className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
              Ver Demonstração
            </Button>
          </motion.div>

          {/* Stats Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mb-12"
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">90%</div>
              <div className="text-sm text-muted-foreground">Redução de Tempo</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">2x</div>
              <div className="text-sm text-muted-foreground">Mais Eficiência</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">24/7</div>
              <div className="text-sm text-muted-foreground">Automação</div>
            </div>
          </motion.div>

          {/* Scroll Indicator */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            onClick={scrollToFeatures}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce"
          >
            <ChevronDown className="h-8 w-8 text-muted-foreground" />
          </motion.button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;