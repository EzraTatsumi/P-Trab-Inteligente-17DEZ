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
import { Eye, EyeOff, AlertTriangle, Loader2 } from "lucide-react";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { EmailVerificationDialog } from "@/components/EmailVerificationDialog";
import { SignupDialog } from "@/components/SignupDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog"; 
import { useSession } from "@/components/SessionContextProvider"; // Importar useSession

const Login = () => {
  const navigate = useNavigate();
  const { loading: loadingSession } = useSession();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailVerificationDialog, setShowEmailVerificationDialog] = useState(false);
  const [showSignupDialog, setShowSignupDialog] = useState(false); 
  const [showForgotPasswordDialog, setShowForgotPasswordDialog] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0); 
  const [rememberMe, setRememberMe] = useState(true);
  
  const { handleEnterToNextField } = useFormNavigation();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null); 

    try {
      const validationResult = loginSchema.safeParse({ email, password });
      if (!validationResult.success) {
        setLoginError(validationResult.error.errors[0].message);
        setLoading(false);
        return;
      }

      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          shouldCreateSession: rememberMe, 
        }
      });
      
      if (error) {
        setLoginAttempts(prev => prev + 1);
        
        const sanitizedMessage = sanitizeAuthError(error);
        
        if (error.message === "Invalid login credentials") {
          if (loginAttempts >= 2) { 
            setLoginError("Credenciais inválidas. Se você não tem uma conta, por favor, crie uma.");
            setShowSignupDialog(true); 
          } else {
            setLoginError("Email ou senha incorretos. Tente novamente.");
          }
          return;
        }
        
        // Se o erro for de e-mail não confirmado, abre o diálogo de verificação
        if (error.message.includes("Email not confirmed")) {
            setShowEmailVerificationDialog(true);
            // Não exibe o erro de login no formulário
            setLoginError(null); 
            return;
        }
        
        setLoginError(sanitizedMessage);
        throw error;
      }
      
      // Se o login for bem-sucedido, o SessionContextProvider fará o redirecionamento
      setLoginAttempts(0);
      
    } catch (error: any) {
      // Se o erro não foi tratado acima (ex: erro de rede), exibe o toast genérico
      if (!loginError) {
        toast.error(sanitizeAuthError(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSuccess = (newEmail: string) => {
    setEmail(newEmail); 
    setPassword(""); 
    setShowSignupDialog(false);
    setShowEmailVerificationDialog(true);
  };
  
  const handleEmailCorrection = (correctedEmail: string) => {
    setEmail(correctedEmail);
    // O EmailVerificationDialog já trata o reenvio
  };
  
  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Verificando sessão...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Acesso à Plataforma</CardTitle>
          <CardDescription>
            Entre com seu e-mail e senha
            <br />
            para gerenciar seus Planos de Trabalho
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
            
            {/* Checkbox Lembrar de Mim */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="remember-me" 
                checked={rememberMe} 
                onCheckedChange={(checked) => setRememberMe(!!checked)} 
              />
              <Label htmlFor="remember-me" className="text-sm font-normal cursor-pointer">
                Lembrar de mim
              </Label>
            </div>
            
            {/* Exibição da mensagem de erro */}
            {loginError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm font-medium">
                  {loginError}
                </AlertDescription>
              </Alert>
            )}
            
            <Button type="submit" className="w-full" disabled={loading} variant="default">
              {loading ? "Aguarde..." : "Entrar"}
            </Button>
            
          </form>
          
          {/* Opções Adicionais (Criar Conta e Recuperar Senha) */}
          <div className="mt-2 flex flex-col items-center space-y-1">
            <Button 
              variant="link" 
              className="text-sm text-primary hover:text-primary-light h-auto p-0"
              onClick={() => setShowSignupDialog(true)}
              disabled={loading}
            >
              Não tem conta? Crie uma agora! Clique aqui.
            </Button>
            
            {/* Botão de Recuperar Senha */}
            <Button 
              variant="link" 
              className="text-sm text-muted-foreground hover:text-primary-light h-auto p-0"
              onClick={() => setShowForgotPasswordDialog(true)}
              disabled={loading}
            >
              Esqueceu sua senha?
            </Button>
          </div>
          
        </CardContent>
      </Card>

      <EmailVerificationDialog
        open={showEmailVerificationDialog}
        onOpenChange={setShowEmailVerificationDialog}
        email={email}
        onEmailCorrected={handleEmailCorrection}
      />
      
      <SignupDialog
        open={showSignupDialog}
        onOpenChange={setShowSignupDialog}
        onSuccess={handleSignupSuccess}
      />
      
      {/* Diálogo de Recuperação de Senha */}
      <ForgotPasswordDialog
        open={showForgotPasswordDialog}
        onOpenChange={setShowForgotPasswordDialog}
      />
    </div>
  );
};

export default Login;