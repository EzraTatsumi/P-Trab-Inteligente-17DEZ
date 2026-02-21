"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Drawer } from 'vaul';
import { MessageSquare, Send, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
}

const AIChatDrawer = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
        scrollToBottom();
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, open]);


  const sendMessage = async (message: string) => {
    if (!message.trim() || loading) return;

    const newMessage: Message = { id: Date.now(), text: message, sender: 'user' };
    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-ai', {
        body: { message },
      });

      if (error) {
        throw new Error(error.message || "Falha na comunicação com a IA.");
      }
      
      const aiResponse = (data as { response: string }).response;

      setMessages(prev => [...prev, { id: Date.now() + 1, text: aiResponse, sender: 'ai' }]);
      
    } catch (e: any) {
      console.error("Chat AI Error:", e);
      const errorMessage = e.message.includes("OpenAI API returned status 401") 
        ? "Erro de configuração: A chave da API da IA não está configurada corretamente no backend."
        : "Desculpe, houve um erro ao processar sua solicitação. Tente novamente.";
        
      setMessages(prev => [...prev, { id: Date.now() + 1, text: errorMessage, sender: 'ai' }]);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const handleClearChat = () => {
    if (confirm("Deseja limpar o histórico do chat?")) {
        setMessages([]);
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} shouldScaleBackground>
      <Drawer.Trigger asChild>
        <Button 
          size="icon" 
          className="fixed bottom-6 right-6 z-50 rounded-full shadow-xl h-14 w-14 bg-primary/50 hover:bg-primary transition-all btn-chat-ia"
          aria-label="Abrir Chat com IA"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="bg-background flex flex-col rounded-t-[10px] h-[90%] md:h-[600px] w-full md:w-[400px] fixed bottom-0 right-0 md:right-6 md:bottom-6 z-[9999] shadow-2xl border border-border">
          <div className="p-4 bg-primary text-primary-foreground rounded-t-[10px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <Drawer.Title className="font-semibold">Assistente Dyad (IA)</Drawer.Title>
            </div>
            <div className="flex items-center gap-2">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClearChat}
                    className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-light/50 text-xs"
                >
                    Limpar
                </Button>
                <Drawer.Close asChild>
                    <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-light/50">
                        <X className="h-5 w-5" />
                    </Button>
                </Drawer.Close>
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground mt-10">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Olá! Sou Dyad, seu assistente de usabilidade do PTrab Inteligente. Como posso ajudar você hoje?</p>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.sender === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] p-3 rounded-lg shadow-sm text-sm markdown-content",
                      msg.sender === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-muted text-foreground rounded-tl-none border'
                    )}
                  >
                    <ReactMarkdown>
                        {msg.text}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-3 rounded-lg shadow-sm text-sm bg-muted text-foreground rounded-tl-none border flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Digitando...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border flex items-center gap-2">
            <Input
              placeholder="Pergunte sobre o app..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) {
                  sendMessage(inputMessage);
                }
              }}
              disabled={loading}
            />
            <Button 
              size="icon" 
              onClick={() => sendMessage(inputMessage)} 
              disabled={loading || !inputMessage.trim()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
      
      <style>{`
        .markdown-content p {
            margin-bottom: 0.5rem;
        }
        .markdown-content ul {
            list-style-type: disc;
            padding-left: 1.5rem;
            margin-top: 0.5rem;
            margin-bottom: 0.5rem;
        }
        .markdown-content li {
            margin-bottom: 0.25rem;
        }
      `}</style>
    </Drawer.Root>
  );
};

export default AIChatDrawer;