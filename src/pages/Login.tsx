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
import { Eye, EyeOff, AlertTriangle, Trash2 } from "lucide-react";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { EmailVerificationDialog } from "@/components/EmailVerificationDialog";
import { SignupDialog } from "@/components/SignupDialog";
import { SignupSuccessDialog } from "@/components/SignupSuccessDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";
import { DeleteUnconfirmedAccountDialog } from "@/components/DeleteUnconfirmedAccountDialog"; // NOVO IMPORT

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailVerificationDialog, setShowEmailVerificationDialog] = useState(false);
  const [showSignupDialog, setShowSignupDialog] = useState(false); 
  
  // NOVO ESTADO: Diálogo de recuperação de senha
  const [showForgotPasswordDialog, setShowForgotPasswordDialog] = useState(false);
  
  // NOVO ESTADO: Diálogo de exclusão de conta não confirmada
  const [showDeleteUnconfirmedDialog, setShowDeleteUnconfirmedDialog] = useState(false);
  
  // NOVO ESTADO: Mensagem de erro de login no formulário
  const [loginError, setLoginError] = useState<string | null>(null);
  
  // Estado para rastrear tentativas de login falhas para o fluxo de sugestão de cadastro
  const [loginAttempts, setLoginAttempts] = useState(0); 
  
  // NOVO ESTADO: Lembrar de mim
  const [rememberMe, setRememberMe] = useState(true);
  
  // NOVOS ESTADOS PARA O FLUXO DE CADASTRO BEM-SUCEDIDO
  const [showSignupSuccessDialog, setShowSignupSuccessDialog] = useState(false);
  const [signupSuccessEmail, setSignupSuccessEmail] = useState("");
  
  const { handleEnterToNextField } = useFormNavigation();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null); // Limpa o erro anterior

    try {
      const validationResult = loginSchema.safeParse({ email, password });
      if (!validationResult.success) {
        setLoginError(validationResult.error.errors[0].message);
        setLoading(false);
        return;
      }

      // Implementação da lógica do "Lembrar de mim"
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          // Se rememberMe for true, a sessão é persistida (padrão Supabase).
          // Se for false, a sessão é de curta duração (session cookie).
          shouldCreateSession: rememberMe, 
        }
      });
      
      if (error) {
        // Incrementa a contagem de tentativas falhas
        setLoginAttempts(prev => prev + 1);
        
        // --- TRATAMENTO ESPECÍFICO PARA E-MAIL NÃO CONFIRMADO ---
        if (error.message === "Email not confirmed") {
            // Apenas abre o diálogo. NÃO define o loginError para evitar o alerta duplicado no formulário.
            setShowEmailVerificationDialog(true); 
            setLoading(false); // Garante que o loading seja desativado
            return; // Sai da função
        }
        // --------------------------------------------------------
        
        const sanitizedMessage = sanitizeAuthError(error);
        
        // Lógica de erro inteligente: Se for credencial inválida e já tentou 3 vezes, sugere cadastro
        if (error.message === "Invalid login credentials") {
          if (loginAttempts >= 2) { // 3ª tentativa (0, 1, 2)
            setLoginError("Credenciais inválidas. Se você não tem uma conta, por favor, crie uma.");
            setShowSignupDialog(true); // Abre o diálogo de sugestão
          } else {
            setLoginError("Email ou senha incorretos. Tente novamente.");
          }
          return;
        }
        
        // Para outros erros
        setLoginError(sanitizedMessage);
        throw error;
      }
      
      // Se o login for bem-sucedido, reseta as tentativas
      setLoginAttempts(0);
      // O SessionContextProvider agora lida com o redirecionamento e o toast de sucesso
      
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
    setEmail(newEmail); // Preenche o email no formulário de login
    setPassword(""); // Limpa a senha
    setShowSignupDialog(false);
    
    // NOVO FLUXO: Exibe o diálogo de sucesso simplificado
    setSignupSuccessEmail(newEmail);
    setShowSignupSuccessDialog(true);
  };

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
            
            {/* Checkbox Lembrar de Mim - MOVIDO PARA CIMA */}
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
            
            {/* NOVO: Exibição da mensagem de erro */}
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
            
            {/* NOVO: Link para Excluir Conta Não Confirmada */}
            <Button 
              variant="link" 
              className="text-xs text-destructive hover:text-destructive/80 h-auto p-0 flex items-center gap-1"
              onClick={() => setShowDeleteUnconfirmedDialog(true)}
              disabled={loading}
            >
              <Trash2 className="h-3 w-3" />
              Excluir conta não confirmada (erro de digitação)
            </Button>
          </div>
          
        </CardContent>
      </Card>

      {/* Diálogo de Verificação de E-mail (Aparece ao tentar logar com e-mail não confirmado) */}
      <EmailVerificationDialog
        open={showEmailVerificationDialog}
        onOpenChange={setShowEmailVerificationDialog}
        email={email}
      />
      
      {/* Diálogo de Cadastro */}
      <SignupDialog
        open={showSignupDialog}
        onOpenChange={setShowSignupDialog}
        onSignupSuccess={handleSignupSuccess}
      />
      
      {/* NOVO: Diálogo de Sucesso de Cadastro (Aparece imediatamente após o cadastro) */}
      <SignupSuccessDialog
        open={showSignupSuccessDialog}
        onOpenChange={setShowSignupSuccessDialog}
        email={signupSuccessEmail}
      />
      
      {/* Diálogo de Recuperação de Senha */}
      <ForgotPasswordDialog
        open={showForgotPasswordDialog}
        onOpenChange={setShowForgotPasswordDialog}
      />
      
      {/* NOVO: Diálogo de Exclusão de Conta Não Confirmada */}
      <DeleteUnconfirmedAccountDialog
        open={showDeleteUnconfirmedDialog}
        onOpenChange={setShowDeleteUnconfirmedDialog}
      />
    </div>
  );
};

export default Login;