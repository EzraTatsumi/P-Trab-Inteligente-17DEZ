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
      richColors={false}
      toastOptions={{
        classNames: {
          // Usando a cor marinho escura (#0f172a) para o texto, combinando com os botões do app
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-[#0f172a] group-[.toaster]:border-border group-[.toaster]:shadow-lg font-sans border",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:bg-white group-[.toaster]:text-[#0f172a]",
          error: "group-[.toaster]:bg-white group-[.toaster]:text-[#0f172a]",
          info: "group-[.toaster]:bg-white group-[.toaster]:text-[#0f172a]",
          warning: "group-[.toaster]:bg-white group-[.toaster]:text-[#0f172a]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }