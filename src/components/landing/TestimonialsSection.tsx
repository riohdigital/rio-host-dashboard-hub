import { useState } from 'react';
import { ChevronLeft, ChevronRight, Star, Quote } from 'lucide-react';
import { motion, AnimatePresence } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const testimonials = [
  {
    id: 1,
    name: 'Carlos Silva',
    role: 'Proprietário de 5 imóveis',
    avatar: 'CS',
    rating: 5,
    text: 'O Rioh Host transformou completamente a gestão das minhas propriedades. Antes eu passava horas organizando reservas e pagamentos, agora tudo é automático. Minha receita aumentou 35% em apenas 6 meses!',
    highlight: 'Receita aumentou 35%'
  },
  {
    id: 2,
    name: 'Ana Beatriz',
    role: 'Co-Anfitriã Profissional',
    avatar: 'AB',
    rating: 5,
    text: 'Como co-anfitriã, preciso gerenciar múltiplas propriedades de diferentes proprietários. O sistema de permissões e o dashboard personalizado me permitem trabalhar com muito mais eficiência.',
    highlight: '15 propriedades gerenciadas'
  },
  {
    id: 3,
    name: 'Maria Santos',
    role: 'Faxineira Autônoma',
    avatar: 'MS',
    rating: 5,
    text: 'O aplicativo mudou minha vida! Consigo ver todas as limpezas do dia, receber pagamentos automaticamente e me comunicar facilmente com os gestores. Muito mais organizado!',
    highlight: '90% menos erros de agenda'
  },
  {
    id: 4,
    name: 'João Pedro',
    role: 'Investidor Imobiliário',
    avatar: 'JP',
    rating: 5,
    text: 'Os relatórios de ROI e análise de investimentos são incríveis. Consigo tomar decisões muito mais assertivas sobre onde investir e como otimizar cada propriedade.',
    highlight: 'ROI médio de 18%'
  }
];

const TestimonialsSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

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
            O Que Nossos Clientes Dizem
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Histórias reais de sucesso de quem já transformou sua gestão
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <div className="relative bg-card rounded-3xl p-8 md:p-12 border border-border/50 overflow-hidden">
            {/* Quote Icon Background */}
            <Quote className="absolute top-4 right-4 h-24 w-24 text-primary/5" />
            
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="relative z-10"
              >
                {/* Rating Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                  ))}
                </div>

                {/* Testimonial Text */}
                <blockquote className="text-lg md:text-xl mb-6 text-foreground/90 leading-relaxed">
                  "{testimonials[currentIndex].text}"
                </blockquote>

                {/* Highlight Badge */}
                <div className="inline-block bg-primary/10 text-primary font-semibold px-4 py-2 rounded-full mb-6">
                  {testimonials[currentIndex].highlight}
                </div>

                {/* Author Info */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={`/avatar-${testimonials[currentIndex].id}.jpg`} />
                    <AvatarFallback className="bg-gradient-primary text-white">
                      {testimonials[currentIndex].avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">{testimonials[currentIndex].name}</div>
                    <div className="text-sm text-muted-foreground">
                      {testimonials[currentIndex].role}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="absolute bottom-8 right-8 flex gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={prevTestimonial}
                className="hover:bg-primary/10 hover:border-primary"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={nextTestimonial}
                className="hover:bg-primary/10 hover:border-primary"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Dots Indicator */}
            <div className="flex justify-center gap-2 mt-8">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-2 w-2 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? 'w-8 bg-primary'
                      : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;