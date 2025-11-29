import { useSession } from "@/components/SessionContextProvider";

/**
 * Hook de conveniência para acessar o contexto de autenticação (SessionContext).
 * É um alias para useSession.
 */
export const useAuth = useSession;