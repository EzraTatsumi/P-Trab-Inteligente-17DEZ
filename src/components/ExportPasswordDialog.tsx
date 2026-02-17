"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock } from "lucide-react";

interface ExportPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string) => void;
  title: string;
  description: string;
  confirmButtonText: string;
  autoComplete?: "new-password" | "current-password";
}

export const ExportPasswordDialog: React.FC<ExportPasswordDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmButtonText,
  autoComplete = "new-password",
}) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return;
    onConfirm(password);
    setPassword("");
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) setPassword("");
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleConfirm} className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="export-password">Senha (mínimo 8 caracteres)</Label>
            <div className="relative">
              <Input
                id="export-password"
                type={showPassword ? "text" : "password"}
                placeholder="Digite a senha para criptografia"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-12" // Aumentado para evitar sobreposição
                minLength={8}
                required
                autoFocus
                autoComplete={autoComplete}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full w-12 hover:bg-muted rounded-r-md"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={password.length < 8}>
              {confirmButtonText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};