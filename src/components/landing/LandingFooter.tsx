import { Mail, Phone, MapPin, Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

const LandingFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <img 
              src="/LOGO RIOH HOST.png" 
              alt="Rioh Host" 
              className="h-12 w-auto mb-4"
            />
            <p className="text-muted-foreground text-sm mb-4">
              Transformando a gestão de propriedades de temporada com tecnologia e inteligência artificial.
            </p>
            <div className="flex gap-3">
              <Button size="icon" variant="ghost" className="hover:bg-primary/10 hover:text-primary">
                <Facebook className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="hover:bg-primary/10 hover:text-primary">
                <Instagram className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="hover:bg-primary/10 hover:text-primary">
                <Linkedin className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="hover:bg-primary/10 hover:text-primary">
                <Twitter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">Links Rápidos</h3>
            <ul className="space-y-2">
              <li>
                <a href="#features" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  Funcionalidades
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  Preços
                </a>
              </li>
              <li>
                <a href="#about" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  Sobre Nós
                </a>
              </li>
              <li>
                <a href="#blog" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  Blog
                </a>
              </li>
              <li>
                <a href="#support" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                  Suporte
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold mb-4">Contato</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-muted-foreground text-sm">
                <Mail className="h-4 w-4" />
                <span>contato@riohhost.com</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground text-sm">
                <Phone className="h-4 w-4" />
                <span>+55 (11) 9999-9999</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground text-sm">
                <MapPin className="h-4 w-4" />
                <span>São Paulo, Brasil</span>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-semibold mb-4">Newsletter</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Receba novidades e dicas exclusivas
            </p>
            <div className="flex gap-2">
              <Input 
                type="email" 
                placeholder="Seu e-mail"
                className="flex-1"
              />
              <Button className="bg-gradient-primary hover:opacity-90 text-white">
                Inscrever
              </Button>
            </div>
          </div>
        </div>

        <Separator className="mb-8" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm text-center md:text-left">
            © {currentYear} Rioh Host. Todos os direitos reservados.
          </p>
          <div className="flex gap-6">
            <a href="/privacy" className="text-muted-foreground hover:text-primary transition-colors text-sm">
              Política de Privacidade
            </a>
            <a href="/terms" className="text-muted-foreground hover:text-primary transition-colors text-sm">
              Termos de Uso
            </a>
            <a href="/cookies" className="text-muted-foreground hover:text-primary transition-colors text-sm">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;