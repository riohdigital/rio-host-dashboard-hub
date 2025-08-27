import { useState } from 'react';
import { Home, Users2, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from '@/lib/motion';
import { Badge } from '@/components/ui/badge';

const profiles = [
  {
    id: 'owner',
    title: 'Proprietários',
    icon: Home,
    color: 'from-blue-500 to-cyan-500',
    features: [
      {
        title: 'Dashboard Financeiro Completo',
        description: 'Acompanhe receitas, despesas e ROI de cada propriedade em tempo real',
        badge: 'Essential'
      },
      {
        title: 'Gestão Multi-Propriedades',
        description: 'Gerencie todas as suas propriedades em uma única plataforma',
        badge: 'Premium'
      },
      {
        title: 'Relatórios Automatizados',
        description: 'Receba relatórios mensais detalhados sobre o desempenho',
        badge: 'AI'
      },
      {
        title: 'Controle de Investimentos',
        description: 'Acompanhe melhorias e calcule o retorno de cada investimento',
        badge: 'New'
      }
    ]
  },
  {
    id: 'cohost',
    title: 'Co-Anfitriões e Gestores',
    icon: Users2,
    color: 'from-purple-500 to-pink-500',
    features: [
      {
        title: 'Central de Reservas',
        description: 'Gerencie check-ins, check-outs e comunicação com hóspedes',
        badge: 'Essential'
      },
      {
        title: 'Gestão de Tarefas',
        description: 'Organize e distribua tarefas para toda a equipe',
        badge: 'Premium'
      },
      {
        title: 'Comunicação Automatizada',
        description: 'Templates e mensagens automáticas para hóspedes',
        badge: 'AI'
      },
      {
        title: 'Controle de Manutenção',
        description: 'Agende e acompanhe manutenções preventivas e corretivas',
        badge: 'New'
      }
    ]
  },
  {
    id: 'cleaner',
    title: 'Faxineiras',
    icon: Sparkles,
    color: 'from-green-500 to-emerald-500',
    features: [
      {
        title: 'Agenda Otimizada',
        description: 'Visualize todas as limpezas do dia em ordem de prioridade',
        badge: 'Essential'
      },
      {
        title: 'Check-list Personalizado',
        description: 'Listas de tarefas específicas para cada propriedade',
        badge: 'Premium'
      },
      {
        title: 'Registro Fotográfico',
        description: 'Envie fotos do antes e depois de cada limpeza',
        badge: 'New'
      },
      {
        title: 'Controle de Pagamentos',
        description: 'Acompanhe seus ganhos e histórico de serviços',
        badge: 'Essential'
      }
    ]
  }
];

const ProfilesSection = () => {
  const [activeProfile, setActiveProfile] = useState('owner');

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
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            Soluções para Cada Perfil
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Funcionalidades específicas para atender as necessidades de cada usuário
          </p>
        </motion.div>

        <Tabs value={activeProfile} onValueChange={setActiveProfile} className="max-w-5xl mx-auto">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            {profiles.map((profile) => (
              <TabsTrigger
                key={profile.id}
                value={profile.id}
                className="flex items-center gap-2 data-[state=active]:bg-gradient-primary data-[state=active]:text-white"
              >
                <profile.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{profile.title}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {profiles.map((profile) => (
            <TabsContent key={profile.id} value={profile.id}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                {/* Gradient Background */}
                <div 
                  className={`absolute inset-0 bg-gradient-to-r ${profile.color} opacity-5 rounded-3xl blur-3xl`}
                />
                
                <div className="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-3xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`p-3 rounded-xl bg-gradient-to-r ${profile.color}`}>
                      <profile.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold">{profile.title}</h3>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {profile.features.map((feature, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1, duration: 0.3 }}
                        className="group bg-background/50 rounded-xl p-5 hover:bg-background/80 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border border-transparent hover:border-primary/20"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-lg group-hover:text-primary transition-colors">
                            {feature.title}
                          </h4>
                          <Badge 
                            variant={feature.badge === 'AI' ? 'default' : 'secondary'}
                            className={feature.badge === 'AI' ? 'bg-gradient-primary text-white' : ''}
                          >
                            {feature.badge}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {feature.description}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
};

export default ProfilesSection;