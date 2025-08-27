import { motion } from '@/lib/motion';
import { Link2, Zap } from 'lucide-react';

const integrations = [
  { name: 'Airbnb', logo: '🏠' },
  { name: 'Booking.com', logo: '🏨' },
  { name: 'Google Calendar', logo: '📅' },
  { name: 'WhatsApp', logo: '💬' },
  { name: 'Stripe', logo: '💳' },
  { name: 'Excel', logo: '📊' },
  { name: 'Gmail', logo: '📧' },
  { name: 'Slack', logo: '💼' }
];

const IntegrationsSection = () => {
  return (
    <section className="py-20 bg-gradient-to-b from-background to-primary/5">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6">
            <Link2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Integrações Poderosas</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            Conecte-se com Suas Ferramentas Favoritas
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Integração perfeita com as principais plataformas do mercado
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {integrations.map((integration, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              whileHover={{ scale: 1.05 }}
              className="group"
            >
              <div className="bg-card hover:bg-card/80 border border-border/50 rounded-2xl p-6 text-center transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
                <div className="text-4xl mb-3">{integration.logo}</div>
                <div className="font-medium">{integration.name}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-center mt-12"
        >
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span>E muitas outras integrações disponíveis via API</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default IntegrationsSection;