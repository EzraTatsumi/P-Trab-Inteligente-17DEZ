import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { sanitizeAuthError } from "@/lib/errorUtils";
import { loginSchema } from "@/lib/validationSchemas";
import { Eye, EyeOff } from "lucide-react";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { EmailVerificationDialog } from "@/components/EmailVerificationDialog";
import { SignupDialog } from "@/components/SignupDialog"; // Importar o novo diálogo de cadastro

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailVerificationDialog, setShowEmailVerificationDialog] = useState(false);
  const [showSignupDialog, setShowSignupDialog] = useState(false); // Novo estado para o diálogo de cadastro
  
  // Estado para rastrear tentativas de login falhas para o fluxo de sugestão de cadastro
  const [loginAttempts, setLoginAttempts] = useState(0); 
  
  const { handleEnterToNextField } = useFormNavigation();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validationResult = loginSchema.safeParse({ email, password });
      if (!validationResult.success) {
        toast.error(validationResult.error.errors[0].message);
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        // Incrementa a contagem de tentativas falhas
        setLoginAttempts(prev => prev + 1);
        
        // Lógica de erro inteligente
        if (error.message === "Invalid login credentials" && loginAttempts >= 1) {
          toast.warning("Credenciais inválidas. Se você não tem uma conta, por favor, crie uma.");
          // Sugere abrir o diálogo de cadastro após a segunda tentativa falha
          if (loginAttempts >= 2) {
            setShowSignupDialog(true);
          }
          return;
        }
        
        throw error;
      }
      
      // Se o login for bem-sucedido, reseta as tentativas
      setLoginAttempts(0);
      // O SessionContextProvider agora lida com o redirecionamento e o toast de sucesso
      
    } catch (error: any) {
      // Se for um erro genérico (não de credenciais inválidas), exibe a mensagem sanitizada
      if (error.message !== "Invalid login credentials") {
        toast.error(sanitizeAuthError(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSuccess = (newEmail: string) => {
    setEmail(newEmail); // Preenche o email no formulário de login
    setPassword(""); // Limpa a senha
    setShowSignupDialog(false);
    setShowEmailVerificationDialog(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Acesso à Plataforma</CardTitle>
          <CardDescription>
            Entre com seu e-mail e senha para gerenciar seus Planos de Trabalho
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Formulário de Login Único */}
          <form onSubmit={handleAuth} autoComplete="on" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-login">Email</Label>
              <Input
                id="email-login"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                onKeyDown={handleEnterToNextField}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-login">Senha</Label>
              <div className="relative">
                <Input
                  id="password-login"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="pr-10"
                  onKeyDown={handleEnterToNextField}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onMouseDown={() => setShowPassword(true)}
                  onMouseUp={() => setShowPassword(false)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading} variant="default">
              {loading ? "Aguarde..." : "Entrar"}
            </Button>
          </form>
          
          {/* Opção de Criar Conta */}
          <div className="mt-4 text-center">
            <Button 
              variant="link" 
              className="text-sm text-primary hover:text-primary-light"
              onClick={() => setShowSignupDialog(true)}
              disabled={loading}
            >
              Não tem conta? Crie uma agora!
            </Button>
          </div>
          
        </CardContent>
      </Card>

      <EmailVerificationDialog
        open={showEmailVerificationDialog}
        onOpenChange={setShowEmailVerificationDialog}
        email={email}
      />
      
      <SignupDialog
        open={showSignupDialog}
        onOpenChange={setShowSignupDialog}
        onSignupSuccess={handleSignupSuccess}
      />
    </div>
  );
};

export default Login;