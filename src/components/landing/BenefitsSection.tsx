import { TrendingUp, Clock, Shield, Users } from 'lucide-react';
import { motion } from '@/lib/motion';
import { Card } from '@/components/ui/card';

const benefits = [
  {
    icon: Clock,
    title: '90% de Redução no Tempo',
    description: 'Automatize tarefas repetitivas e foque no que realmente importa para seu negócio.',
    stat: '8h → 45min',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    icon: TrendingUp,
    title: 'Aumento de 40% na Receita',
    description: 'Otimize preços, reduza vacância e maximize o retorno de cada propriedade.',
    stat: '+40%',
    color: 'from-green-500 to-emerald-500'
  },
  {
    icon: Shield,
    title: '100% de Segurança',
    description: 'Dados criptografados, backups automáticos e conformidade total com LGPD.',
    stat: 'ISO 27001',
    color: 'from-purple-500 to-pink-500'
  },
  {
    icon: Users,
    title: 'Satisfação Garantida',
    description: 'Melhore a experiência dos hóspedes e receba mais avaliações 5 estrelas.',
    stat: '4.9★',
    color: 'from-orange-500 to-red-500'
  }
];

const BenefitsSection = () => {
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
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            Resultados Comprovados
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Números reais de clientes que transformaram sua gestão com o Rioh Host
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{ scale: 1.05, translateY: -5 }}
            >
              <Card className="relative h-full overflow-hidden group hover:shadow-xl transition-all duration-300">
                {/* Gradient Overlay */}
                <div 
                  className={`absolute inset-0 bg-gradient-to-br ${benefit.color} opacity-5 group-hover:opacity-10 transition-opacity duration-300`}
                />
                
                <div className="relative p-6">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${benefit.color} mb-4`}>
                    <benefit.icon className="h-6 w-6 text-white" />
                  </div>
                  
                  <div className="text-3xl font-bold mb-2 bg-gradient-to-r bg-clip-text text-transparent"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${benefit.color.split(' ')[1]}, ${benefit.color.split(' ')[3]})`
                    }}
                  >
                    {benefit.stat}
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground text-sm">{benefit.description}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Before/After Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-16 max-w-4xl mx-auto"
        >
          <div className="bg-card rounded-3xl p-8 border border-border/50">
            <h3 className="text-2xl font-bold text-center mb-8">Antes vs Depois do Rioh Host</h3>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="font-semibold text-destructive flex items-center gap-2">
                  <span className="text-2xl">❌</span> Antes
                </h4>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-1">•</span>
                    <span>Planilhas desorganizadas e propensas a erros</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-1">•</span>
                    <span>Comunicação manual com cada hóspede</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-1">•</span>
                    <span>Dificuldade para acompanhar múltiplas propriedades</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-1">•</span>
                    <span>Relatórios demorados e imprecisos</span>
                  </li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-semibold text-primary flex items-center gap-2">
                  <span className="text-2xl">✅</span> Depois
                </h4>
                <ul className="space-y-3 text-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Dashboard centralizado com dados em tempo real</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Mensagens automáticas e personalizadas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Visão unificada de todas as propriedades</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Relatórios profissionais gerados instantaneamente</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default BenefitsSection;