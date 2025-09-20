import { addScore, readScores } from "../score";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
    return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { user_name, game_title, score } = body as {
            user_name?: string;
            game_title?: string;
            score?: number;
        };

        if (typeof user_name !== "string" || user_name.trim().length === 0) {
            return Response.json(
                { error: "user_name is required" },
                { status: 400, headers: corsHeaders }
            );
        }
        if (!Number.isFinite(score as number)) {
            return Response.json(
                { error: "score must be a finite number" },
                { status: 400, headers: corsHeaders }
            );
        }

        const title = typeof game_title === "string" && game_title.trim().length > 0
            ? game_title
            : "kingyo-sukui";

        const row = await addScore(user_name, title, Number(score));
        return Response.json(row, { status: 201, headers: corsHeaders });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        const status = /invalid/i.test(message) ? 400 : 500;
        return Response.json({ error: message }, { status, headers: corsHeaders });
    }
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const sp = url.searchParams;

        const limitStr = sp.get("limit");
        const limit = limitStr ? Number(limitStr) : 10;

        const user_name = sp.get("user_name") || undefined;
        const game_title = sp.get("game_title") || undefined;
        const created_from = sp.get("created_from") || undefined;
        const created_to = sp.get("created_to") || undefined;

        const min_scoreStr = sp.get("min_score");
        const max_scoreStr = sp.get("max_score");
        const min_score = min_scoreStr !== null ? Number(min_scoreStr) : undefined;
        const max_score = max_scoreStr !== null ? Number(max_scoreStr) : undefined;

        const orderByRaw = sp.get("orderBy") || undefined;
        const orderBy = orderByRaw === "created_at" ? "created_at" : orderByRaw === "score" ? "score" : undefined;

        const ascendingRaw = sp.get("ascending");
        const ascending = ascendingRaw != null ? ascendingRaw === "true" || ascendingRaw === "1" : undefined;

        const data = await readScores(limit, {
            user_name: user_name || undefined,
            game_title: game_title || undefined,
            created_from: created_from || undefined,
            created_to: created_to || undefined,
            min_score: Number.isFinite(min_score as number) ? (min_score as number) : undefined,
            max_score: Number.isFinite(max_score as number) ? (max_score as number) : undefined,
            orderBy: orderBy,
            ascending: ascending,
        });

        return Response.json(data, { status: 200, headers: corsHeaders });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        const status = /invalid/i.test(message) ? 400 : 500;
        return Response.json({ error: message }, { status, headers: corsHeaders });
    }
}
