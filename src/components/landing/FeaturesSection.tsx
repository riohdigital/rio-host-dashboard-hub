import { 
  BarChart3, 
  Calendar, 
  Users, 
  FileText, 
  Bell, 
  Shield,
  Zap,
  Globe
} from 'lucide-react';
import { motion } from '@/lib/motion';

const features = [
  {
    icon: BarChart3,
    title: 'Dashboard Completo',
    description: 'Visualize todas as métricas importantes em tempo real com gráficos interativos e KPIs personalizados.',
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    icon: Calendar,
    title: 'Gestão de Reservas',
    description: 'Controle todas as reservas em um só lugar, com sincronização automática com OTAs.',
    gradient: 'from-purple-500 to-pink-500'
  },
  {
    icon: Users,
    title: 'Controle de Equipe',
    description: 'Gerencie faxineiras, co-anfitriões e toda a equipe com permissões granulares.',
    gradient: 'from-green-500 to-emerald-500'
  },
  {
    icon: FileText,
    title: 'Relatórios Profissionais',
    description: 'Gere relatórios detalhados para análise financeira e tomada de decisão.',
    gradient: 'from-orange-500 to-red-500'
  },
  {
    icon: Bell,
    title: 'Alertas Inteligentes',
    description: 'Receba notificações automáticas sobre eventos importantes e prazos.',
    gradient: 'from-indigo-500 to-purple-500'
  },
  {
    icon: Shield,
    title: 'Segurança Total',
    description: 'Dados criptografados e backup automático para máxima proteção.',
    gradient: 'from-gray-600 to-gray-800'
  },
  {
    icon: Zap,
    title: 'Automação Avançada',
    description: 'Automatize tarefas repetitivas e economize horas de trabalho.',
    gradient: 'from-yellow-500 to-orange-500'
  },
  {
    icon: Globe,
    title: 'Integração Completa',
    description: 'Conecte-se com Airbnb, Booking, calendários e outros sistemas.',
    gradient: 'from-teal-500 to-blue-500'
  }
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 bg-gradient-to-b from-background to-primary/5">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            Tudo que Você Precisa
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Uma plataforma completa para gerenciar suas propriedades com eficiência e inteligência
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{ scale: 1.05, translateY: -5 }}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl blur-xl"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${feature.gradient.split(' ')[1]}, ${feature.gradient.split(' ')[3]})`
                }}
              />
              <div className="relative bg-card hover:bg-card/80 border border-border/50 rounded-2xl p-6 h-full transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${feature.gradient} mb-4`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;