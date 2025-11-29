import { Shield } from "lucide-react";

export const Footer = () => {
  return (
    <footer id="main-footer" className="bg-primary text-primary-foreground py-16 pb-8 relative overflow-hidden"> {/* Reduzido pb-16 para pb-8 */}
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent rounded-full blur-3xl" />
      </div>

      <div className="container px-4 md:px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Shield className="w-6 h-6 text-accent-foreground" />
              </div>
              <span className="text-xl font-bold font-display">PTrab Inteligente</span>
            </div>
            <p className="text-primary-foreground/70 text-sm leading-relaxed max-w-md">
              Sistema oficial de gestão do Plano de Trabalho do Exército Brasileiro. 
              Desenvolvido com tecnologia de ponta para máxima eficiência operacional.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold mb-4 font-display">Recursos</h3>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li className="hover:text-accent transition-colors cursor-pointer">Documentação</li>
              <li className="hover:text-accent transition-colors cursor-pointer">Manual do Usuário</li>
              <li className="hover:text-accent transition-colors cursor-pointer">Suporte Técnico</li>
              <li className="hover:text-accent transition-colors cursor-pointer">Conformidade</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold mb-4 font-display">Contato</h3>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li>CITEx</li>
              <li>Comando Militar da Amazônia</li>
              <li>Brasília - DF</li>
              <li className="text-accent hover:text-accent-light transition-colors cursor-pointer">
                suporte@ptrab.eb.mil.br
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-primary-foreground/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-primary-foreground/50 text-center md:text-left">
            © 2025 Exército Brasileiro • Sistema de uso institucional militar
          </p>
          <div className="flex gap-6 text-sm text-primary-foreground/50">
            <span className="hover:text-accent transition-colors cursor-pointer">Privacidade</span>
            <span className="hover:text-accent transition-colors cursor-pointer">Termos</span>
            <span className="hover:text-accent transition-colors cursor-pointer">Segurança</span>
          </div>
        </div>
      </div>
    </footer>
  );
};