-- Policy for SELECT (Read)
CREATE POLICY "Users can only see their own passage directives" ON public.diretrizes_passagens 
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- Policy for INSERT (Create)
CREATE POLICY "Users can only insert their own passage directives" ON public.diretrizes_passagens 
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

-- Policy for UPDATE (Modify)
CREATE POLICY "Users can only update their own passage directives" ON public.diretrizes_passagens 
FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()));

-- Policy for DELETE (Remove)
CREATE POLICY "Users can only delete their own passage directives" ON public.diretrizes_passagens 
FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));