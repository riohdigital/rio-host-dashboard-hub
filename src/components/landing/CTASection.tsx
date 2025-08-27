import { ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from '@/lib/motion';

interface CTASectionProps {
  onGetStarted: () => void;
  isLoggedIn: boolean;
}

const CTASection = ({ onGetStarted, isLoggedIn }: CTASectionProps) => {
  return (
    <section className="py-20 bg-gradient-to-b from-background to-primary/10">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <div className="bg-gradient-to-r from-primary to-secondary p-1 rounded-3xl">
            <div className="bg-background rounded-3xl p-8 md:p-12 text-center">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
                Pronto para Transformar sua Gestão?
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Junte-se a centenas de proprietários e gestores que já revolucionaram suas operações
              </p>

              <div className="grid md:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span className="text-sm">Teste grátis por 14 dias</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span className="text-sm">Sem cartão de crédito</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span className="text-sm">Cancele quando quiser</span>
                </div>
              </div>

              <Button
                size="lg"
                onClick={onGetStarted}
                className="bg-gradient-primary hover:opacity-90 text-white font-semibold px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
              >
                {isLoggedIn ? 'Ir para o Dashboard' : 'Começar Teste Grátis'}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>

              <p className="text-sm text-muted-foreground mt-4">
                Configuração em menos de 5 minutos • Suporte 24/7
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;