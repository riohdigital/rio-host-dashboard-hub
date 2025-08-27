import { Shield, Lock, Server, FileCheck } from 'lucide-react';
import { motion } from '@/lib/motion';
import { Badge } from '@/components/ui/badge';

const securityFeatures = [
  {
    icon: Lock,
    title: 'Criptografia de Ponta',
    description: 'Todos os dados são criptografados com AES-256, o mesmo padrão usado por bancos.',
  },
  {
    icon: Server,
    title: 'Backup Automático',
    description: 'Backups realizados a cada hora com redundância em múltiplos data centers.',
  },
  {
    icon: Shield,
    title: 'Conformidade LGPD',
    description: 'Totalmente adequado à Lei Geral de Proteção de Dados brasileira.',
  },
  {
    icon: FileCheck,
    title: 'Auditoria Completa',
    description: 'Registro detalhado de todas as ações para máxima transparência.',
  }
];

const SecuritySection = () => {
  return (
    <section className="py-20 bg-gradient-to-b from-primary/5 to-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Badge className="mb-6 bg-gradient-primary text-white">
            ISO 27001 Certified
          </Badge>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            Segurança de Nível Bancário
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Seus dados protegidos com as tecnologias mais avançadas do mercado
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {securityFeatures.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="text-center group"
            >
              <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 mb-4 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-12 max-w-3xl mx-auto"
        >
          <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-3xl p-8 border border-primary/10 text-center">
            <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Garantia de Privacidade</h3>
            <p className="text-muted-foreground">
              Nunca compartilhamos seus dados com terceiros. Você tem controle total sobre suas informações
              e pode exportar ou deletar tudo a qualquer momento.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default SecuritySection;