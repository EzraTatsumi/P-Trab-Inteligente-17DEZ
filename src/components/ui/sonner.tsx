"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors={false} // Força explicitamente a desativação das cores vibrantes
      toastOptions={{
        classNames: {
          // Base do toast: fundo branco e texto azul
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-blue-700 group-[.toaster]:border-border group-[.toaster]:shadow-lg font-sans border",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // Forçamos o mesmo estilo para todos os tipos, anulando qualquer cor nativa
          success: "group-[.toaster]:bg-white group-[.toaster]:text-blue-700",
          error: "group-[.toaster]:bg-white group-[.toaster]:text-blue-700",
          info: "group-[.toaster]:bg-white group-[.toaster]:text-blue-700",
          warning: "group-[.toaster]:bg-white group-[.toaster]:text-blue-700",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }