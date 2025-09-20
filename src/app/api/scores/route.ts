import { addScore } from "../score";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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
