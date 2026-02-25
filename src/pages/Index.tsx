"use client";

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/components/SessionContextProvider";
import { Loader2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useSession();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        navigate("/ptrab");
      } else {
        navigate("/login");
      }
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground font-medium">Acessando sistema...</p>
      </div>
    </div>
  );
};

export default Index;