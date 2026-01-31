-- Drop existing policies to recreate them with optimized syntax
DROP POLICY IF EXISTS "Users can only see their own passage directives" ON public.diretrizes_passagens;
DROP POLICY IF EXISTS "Users can only insert their own passage directives" ON public.diretrizes_passagens;
DROP POLICY IF EXISTS "Users can only update their own passage directives" ON public.diretrizes_passagens;
DROP POLICY IF EXISTS "Users can only delete their own passage directives" ON public.diretrizes_passagens;