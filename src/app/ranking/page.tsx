"use client";

import { useEffect, useMemo, useState } from "react";

type ScoreRow = {
	id: string;
	user_name: string;
	game_title: string;
	score: number;
	created_at: string;
};

export default function RankingPage() {
	const [query, setQuery] = useState("");
	const [limit, setLimit] = useState(10);
	const [sort, setSort] = useState<"score" | "created_at">("score");
	const [asc, setAsc] = useState(false);
	const [data, setData] = useState<ScoreRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let abort = false;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const params = new URLSearchParams();
				params.set("limit", String(Math.max(100, limit * 10)));
				const res = await fetch(`/api/scores?${params.toString()}`, {
					headers: { Accept: "application/json" },
				});
				if (!res.ok) {
					const body = await res.json().catch(() => ({}));
					throw new Error((body as any)?.error || `Request failed: ${res.status}`);
				}
				const rows = (await res.json()) as ScoreRow[];
				if (!abort) setData(Array.isArray(rows) ? rows : []);
			} catch (e: any) {
				if (!abort) setError(e?.message || "Failed to load rankings");
			} finally {
				if (!abort) setLoading(false);
			}
		})();
		return () => {
			abort = true;
		};
	}, [limit]);

	const groups = useMemo(() => {
		let r = [...data];
		if (query.trim()) {
			const q = query.trim().toLowerCase();
			r = r.filter(
				(x) =>
					x.user_name.toLowerCase().includes(q) ||
					x.game_title.toLowerCase().includes(q)
			);
		}
		const byGame = new Map<string, ScoreRow[]>();
		for (const row of r) {
			const list = byGame.get(row.game_title) ?? [];
			list.push(row);
			byGame.set(row.game_title, list);
		}
		const result = Array.from(byGame.entries()).map(([game, list]) => {
			list.sort((a, b) => {
				if (sort === "score") return asc ? a.score - b.score : b.score - a.score;
				const at = new Date(a.created_at).getTime();
				const bt = new Date(b.created_at).getTime();
				return asc ? at - bt : bt - at;
			});
			return { game, rows: list.slice(0, Math.max(1, limit)) };
		});
		result.sort((a, b) => a.game.localeCompare(b.game));
		return result;
	}, [data, query, limit, sort, asc]);

	function gameEmoji(title: string) {
		const t = title.toLowerCase();
		if (t.includes("kingyo")) return "🐟🏮";
		if (t.includes("goldfish")) return "🐠🎆";
		if (t.includes("射的") || t.includes("syateki")) return "🎯🏮";
		return "🎪🎈";
	}

	return (
		<main className="min-h-screen w-full bg-gradient-to-b from-rose-50 via-amber-50 to-sky-50 text-neutral-900 overflow-y-auto touch-pan-y overscroll-y-contain">
			<div className="mx-auto max-w-4xl p-5 sm:p-8">
				<header className="flex flex-col gap-3 sm:gap-4 mb-6">
					<div className="flex items-center gap-3">
						<span className="text-2xl sm:text-3xl">🏮</span>
						<h1 className="text-2xl sm:text-3xl font-extrabold tracking-wide">縁日ランキング</h1>
						<span className="text-2xl sm:text-3xl">🏮</span>
					</div>
					<p className="text-base sm:text-lg text-neutral-700">ゲームごとのトップスコアを楽しくチェックしよう！🎆🎈</p>
					<div className="flex flex-wrap items-stretch gap-3 w-full">
						<div className="flex items-center gap-2 bg-white rounded-full border border-rose-200 px-3 py-2 shadow-sm w-full sm:w-72">
							<span className="text-lg">🔍</span>
							<input
								className="outline-none w-full text-base"
								placeholder="なまえ／ゲームで検索"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
							/>
						</div>
						<label className="flex items-center gap-2 bg-white rounded-full border border-amber-200 px-3 py-2 shadow-sm">
							<span className="text-base text-neutral-700">件数</span>
							<input
								type="number"
								min={1}
								className="outline-none w-20 text-base"
								value={limit}
								onChange={(e) => setLimit(Number(e.target.value) || 10)}
							/>
						</label>
						<label className="flex items-center gap-2 bg-white rounded-full border border-sky-200 px-3 py-2 shadow-sm">
							<span className="text-base text-neutral-700">並び</span>
							<select
								className="outline-none text-base bg-transparent"
								value={sort}
								onChange={(e) => setSort(e.target.value as any)}
							>
								<option value="score">スコア</option>
								<option value="created_at">日付</option>
							</select>
						</label>
						<label className="flex items-center gap-2 bg-white rounded-full border border-violet-200 px-3 py-2 shadow-sm">
							<input
								type="checkbox"
								checked={asc}
								onChange={(e) => setAsc(e.target.checked)}
							/>
							<span className="text-base text-neutral-800">小さい順</span>
						</label>
					</div>
				</header>

				{error && (
					<div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
				)}
				{loading && (
					<div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">読み込み中...</div>
				)}

				<section className="space-y-6">
					{groups.map(({ game, rows }) => (
						<div key={game} className="bg-white border border-rose-200 rounded-xl shadow-sm overflow-hidden">
							<div className="px-4 py-3 bg-gradient-to-r from-rose-50 to-amber-50 border-b border-rose-200 flex items-center justify-between">
								<h2 className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
									<span>{gameEmoji(game)}</span>
									<span>{game}</span>
								</h2>
								<span className="text-sm sm:text-base text-neutral-700">上位 {rows.length}</span>
							</div>
							<div className="hidden sm:block overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
								<table className="w-full text-left table-fixed">
									<thead className="bg-neutral-50">
										<tr>
											<th className="px-4 py-3 w-20">順位</th>
											<th className="px-4 py-3">なまえ</th>
											<th className="px-4 py-3 w-32">スコア</th>
											<th className="px-4 py-3 w-56">日付</th>
										</tr>
									</thead>
									<tbody>
										{rows.map((r, idx) => {
											const displayRank = idx + 1;
											const isTop1 = displayRank === 1;
											const isTop2 = displayRank === 2;
											const isTop3 = displayRank === 3;
											const rowBg = isTop1
												? "bg-yellow-50"
												: isTop2
												? "bg-gray-50"
												: isTop3
												? "bg-orange-50"
												: idx % 2
												? "bg-neutral-50"
												: "bg-white";
											const rankBadgeClass = isTop1
												? "bg-yellow-400 text-yellow-900"
												: isTop2
												? "bg-gray-300 text-gray-900"
												: isTop3
												? "bg-orange-300 text-orange-900"
												: "bg-neutral-200 text-neutral-800";
											return (
												<tr key={`${game}-${r.id || r.user_name}-${idx}`} className={rowBg}>
													<td className="px-4 py-2">
														<span className="mr-2 text-lg align-middle">
															{isTop1 ? "🥇" : isTop2 ? "🥈" : isTop3 ? "🥉" : "🎈"}
														</span>
														<span className={`inline-flex items-center justify-center min-w-8 px-2 py-1 rounded text-sm font-bold ${rankBadgeClass}`}>
															{displayRank}
														</span>
													</td>
													<td className="px-4 py-2 font-semibold">{r.user_name}</td>
													<td className="px-4 py-2 text-base">{r.score.toLocaleString()}</td>
													<td className="px-4 py-2 text-sm text-neutral-700">{new Date(r.created_at).toLocaleString()}</td>
												</tr>
											);
										})}
										{rows.length === 0 && (
											<tr>
												<td className="px-4 py-6 text-center text-neutral-500" colSpan={4}>
													データがありません
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>

							<div className="sm:hidden divide-y divide-neutral-200">
								{rows.map((r, idx) => {
									const displayRank = idx + 1;
									const isTop1 = displayRank === 1;
									const isTop2 = displayRank === 2;
									const isTop3 = displayRank === 3;
									const rowBg = isTop1
										? "bg-yellow-50"
										: isTop2
										? "bg-gray-50"
										: isTop3
										? "bg-orange-50"
										: "bg-white";
									const rankBadgeClass = isTop1
										? "bg-yellow-400 text-yellow-900"
										: isTop2
										? "bg-gray-300 text-gray-900"
										: isTop3
										? "bg-orange-300 text-orange-900"
										: "bg-neutral-200 text-neutral-800";
									return (
										<div key={`${game}-card-${r.id || r.user_name}-${idx}`} className={`${rowBg} px-4 py-4`}>
											<div className="flex items-start justify-between gap-3">
												<div className="flex items-center gap-3">
													<span className="text-2xl">
														{isTop1 ? "🥇" : isTop2 ? "🥈" : isTop3 ? "🥉" : "🎈"}
													</span>
													<div>
														<div className="text-base font-extrabold">{r.user_name}</div>
														<div className="mt-1 text-xs text-neutral-600">{new Date(r.created_at).toLocaleString()}</div>
													</div>
												</div>
												<div className="text-right">
													<div className={`inline-block ${rankBadgeClass} rounded-full px-3 py-1 text-xs font-bold mb-1`}>#{displayRank}</div>
													<div className="text-sm text-neutral-600">スコア</div>
													<div className="text-lg font-extrabold">{r.score.toLocaleString()}</div>
												</div>
											</div>
										</div>
									);
								})}
								{rows.length === 0 && (
									<div className="px-4 py-6 text-center text-neutral-500">データがありません</div>
								)}
							</div>
						</div>
					))}
				</section>
			</div>
		</main>
	);
}

