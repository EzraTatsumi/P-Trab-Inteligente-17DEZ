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