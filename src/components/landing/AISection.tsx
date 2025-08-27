import { useState, useEffect } from 'react';
import { Brain, Zap, Bell, TrendingUp, Clock, Shield } from 'lucide-react';
import { motion } from '@/lib/motion';
import { Badge } from '@/components/ui/badge';

const aiFeatures = [
  {
    icon: Bell,
    title: 'Anfitrião Alerta',
    description: 'Sistema inteligente de notificações que aprende com seus padrões e envia alertas personalizados no momento certo.',
    status: 'available'
  },
  {
    icon: TrendingUp,
    title: 'Previsão de Demanda',
    description: 'IA analisa histórico e tendências para prever ocupação e sugerir ajustes de preços.',
    status: 'coming'
  },
  {
    icon: Zap,
    title: 'Automação Inteligente',
    description: 'Automatize respostas, check-ins e tarefas repetitivas com aprendizado de máquina.',
    status: 'available'
  },
  {
    icon: Shield,
    title: 'Detecção de Anomalias',
    description: 'Identifica automaticamente problemas e situações fora do padrão antes que se tornem críticos.',
    status: 'coming'
  }
];

const AISection = () => {
  const [countdown, setCountdown] = useState({ days: 30, hours: 0, minutes: 0 });

  useEffect(() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);

    const interval = setInterval(() => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

        setCountdown({ days, hours, minutes });
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-20 bg-gradient-to-b from-background via-primary/5 to-background relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
            <span className="font-semibold bg-gradient-primary bg-clip-text text-transparent">
              Powered by Artificial Intelligence
            </span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            Inteligência Artificial Revolucionária
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transforme a gestão de suas propriedades com tecnologia de ponta que aprende e evolui com seu negócio
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
          {aiFeatures.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-6 hover:border-primary/30 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-gradient-primary shrink-0">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{feature.title}</h3>
                      <Badge variant={feature.status === 'available' ? 'default' : 'secondary'}>
                        {feature.status === 'available' ? 'Disponível' : 'Em Breve'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Coming Soon Counter */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-3xl p-8 border border-primary/20">
            <div className="text-center">
              <Clock className="h-8 w-8 text-primary mx-auto mb-4 animate-pulse" />
              <h3 className="text-2xl font-bold mb-2">Novos Recursos com IA Chegando</h3>
              <p className="text-muted-foreground mb-6">
                Estamos trabalhando em funcionalidades revolucionárias que vão transformar sua experiência
              </p>
              
              <div className="flex justify-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{countdown.days}</div>
                  <div className="text-sm text-muted-foreground">Dias</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{countdown.hours}</div>
                  <div className="text-sm text-muted-foreground">Horas</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{countdown.minutes}</div>
                  <div className="text-sm text-muted-foreground">Minutos</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AISection;