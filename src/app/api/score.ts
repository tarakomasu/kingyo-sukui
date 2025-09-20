import 'server-only';
import { createClient } from '@supabase/supabase-js';

type ScoreRow = {
    id: string;
    user_name: string;
    game_title: string;
    score: number;
    created_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
}
if (!supabaseKey) {
    throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function addScore(name: string, game_title: string, score: number): Promise<ScoreRow> {
    if (typeof name !== 'string' || name.trim().length === 0) {
        throw new Error('Invalid name');
    }
    if (typeof game_title !== 'string' || game_title.trim().length === 0) {
        throw new Error('Invalid game title');
    }
    if (!Number.isFinite(score)) {
        throw new Error('Invalid score');
    }

    const { data, error } = await supabase
        .from('scores')
        .insert([{ user_name: name.trim(), game_title: game_title.trim(), score }])
        .select('*')
        .single();

    if (error) {
        throw new Error(error.message);
    }
    return data as ScoreRow;
}

type ReadScoreFilters = {
    user_name?: string;
    game_title?: string;
    created_from?: string | Date;
    created_to?: string | Date;
    min_score?: number;
    max_score?: number;
    orderBy?: 'score' | 'created_at';
    ascending?: boolean;
};

export async function readScores(
    limit: number,
    filters?: ReadScoreFilters
): Promise<ScoreRow[]> {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;

    let query = supabase.from('scores').select('*');

    if (filters?.user_name) {
        query = query.eq('user_name', filters.user_name);
    }
    if (filters?.game_title) {
        query = query.eq('game_title', filters.game_title);
    }
    if (filters?.created_from) {
        const from =
            filters.created_from instanceof Date
                ? filters.created_from.toISOString()
                : new Date(filters.created_from).toISOString();
        query = query.gte('created_at', from);
    }
    if (filters?.created_to) {
        const to =
            filters.created_to instanceof Date
                ? filters.created_to.toISOString()
                : new Date(filters.created_to).toISOString();
        query = query.lte('created_at', to);
    }
    if (typeof filters?.min_score === 'number') {
        query = query.gte('score', filters.min_score);
    }
    if (typeof filters?.max_score === 'number') {
        query = query.lte('score', filters.max_score);
    }

    const orderBy = filters?.orderBy ?? 'score';
    const ascending = filters?.ascending ?? false;
    query = query.order(orderBy, { ascending }).limit(safeLimit);

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }
    return (data ?? []) as ScoreRow[];
}