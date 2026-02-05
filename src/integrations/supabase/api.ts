import { supabase } from "./client";
import { Tables, TableName } from "./types";

/**
 * Fetches all records from a specific table for the current user.
 * Assumes the table has a 'user_id' column and RLS is configured.
 * @param tableName The name of the table.
 * @returns A promise that resolves to an array of records.
 */
export async function fetchUserRecords<T extends TableName>(tableName: T): Promise<Tables<T>[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error("Usuário não autenticado.");
    }

    // Use 'as any' to bypass TypeScript's strictness on dynamic table names
    const { data, error } = await (supabase.from(tableName) as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    return data as Tables<T>[];
}

/**
 * Inserts a new record into a table.
 * @param tableName The name of the table.
 * @param record The record data to insert.
 * @returns A promise that resolves to the inserted record.
 */
export async function insertRecord<T extends TableName>(tableName: T, record: Tables<T>['Insert']): Promise<Tables<T>> {
    const { data, error } = await (supabase.from(tableName) as any)
        .insert([record])
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data as Tables<T>;
}

/**
 * Updates an existing record in a table.
 * @param tableName The name of the table.
 * @param id The ID of the record to update.
 * @param record The record data to update.
 * @returns A promise that resolves to the updated record.
 */
export async function updateRecord<T extends TableName>(tableName: T, id: string, record: Tables<T>['Update']): Promise<Tables<T>> {
    const { data, error } = await (supabase.from(tableName) as any)
        .update(record)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data as Tables<T>;
}

/**
 * Deletes a record from a table by ID.
 * @param tableName The name of the table.
 * @param id The ID of the record to delete.
 */
export async function deleteRecord<T extends TableName>(tableName: T, id: string): Promise<void> {
    const { error } = await (supabase.from(tableName) as any)
        .delete()
        .eq('id', id);

    if (error) {
        throw error;
    }
}

/**
 * Fetches PTrab and owner profile data for a share link preview.
 * @param ptrabId The ID of the PTrab.
 * @param shareToken The share token associated with the PTrab.
 * @returns A promise that resolves to PTrab and owner data, or null if invalid.
 */
export async function fetchSharePreview(ptrabId: string, shareToken: string): Promise<{ ptrab: Tables<'p_trab'>, ownerProfile: Tables<'profiles'> } | null> {
    // 1. Fetch PTrab data using both ID and token
    const { data: ptrabData, error: ptrabError } = await supabase
        .from('p_trab')
        .select('*, user_id')
        .eq('id', ptrabId)
        .eq('share_token', shareToken)
        .maybeSingle();

    if (ptrabError || !ptrabData) {
        console.error("[fetchSharePreview] PTrab not found or token invalid:", ptrabError);
        return null;
    }

    // 2. Fetch owner profile data
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', ptrabData.user_id)
        .maybeSingle();

    if (profileError || !profileData) {
        console.error("[fetchSharePreview] Owner profile not found:", profileError);
        return null;
    }

    return {
        ptrab: ptrabData,
        ownerProfile: profileData,
    };
}

/**
 * Fetches the LPC (Local Price Consultation) reference for a specific PTrab.
 * @param ptrabId The ID of the PTrab.
 * @returns A promise that resolves to the RefLPC record or null.
 */
export async function fetchFuelPrice(ptrabId: string): Promise<Tables<'p_trab_ref_lpc'> | null> {
    const { data, error } = await supabase
        .from('p_trab_ref_lpc')
        .select('*')
        .eq('p_trab_id', ptrabId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}