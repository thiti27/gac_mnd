import { useState, useEffect } from "react";

export default function PodiumLeaderboard() {
    const [allAttempts, setAllAttempts] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false); // สำหรับปุ่มรีเฟรช

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const firstPageSize = 17;
    const normalPageSize = 20;

    // ==================== ดึงข้อมูลจาก Google Sheet ====================
    const fetchData = async (isManualRefresh = false) => {
        if (isManualRefresh) setIsRefreshing(true);

        try {
            const res = await fetch("https://script.google.com/macros/s/AKfycbyDFNCuI-TwiJi1_xQn5w-QTAHDEu9pAJ-AzJK-GT4AsxbA4wpM1-DYOoD-qg2ZrJra/exec");
            const data = await res.json();

            setAllAttempts(data);

            // Deduplicate
            const bestMap = {};
            data.forEach(item => {
                const id = item.employeeId;
                if (!bestMap[id]) {
                    bestMap[id] = item;
                } else {
                    const current = bestMap[id];
                    const isBetter =
                        item.score > current.score ||
                        (item.score === current.score && item.time < current.time) ||
                        (item.score === current.score && item.time === current.time && new Date(item.date) < new Date(current.date));

                    if (isBetter) bestMap[id] = item;
                }
            });

            const sorted = Object.values(bestMap).sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.time !== a.time) return a.time - b.time;
                return new Date(a.date) - new Date(b.date);
            });

            setLeaderboard(sorted);
        } catch (error) {
            console.error("โหลดข้อมูลจาก Google Sheet ล้มเหลว:", error);
        } finally {
            setLoading(false);
            if (isManualRefresh) setIsRefreshing(false);
        }
    };

    // โหลดครั้งแรก
    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const top3 = leaderboard.slice(0, 3);

    const searchLower = searchTerm.trim().toLowerCase();

    const searchedEmployeeId = allAttempts.find(p =>
        String(p.employeeId || '').toLowerCase() === searchLower
    )?.employeeId || null;

    const employeeHistory = searchedEmployeeId
        ? allAttempts
            .filter(p => String(p.employeeId || '').toLowerCase() === searchLower)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
        : [];

    const filteredOthers = searchTerm.trim()
        ? leaderboard.slice(3).filter(p =>
            String(p.employeeId || '').toLowerCase().includes(searchLower)
        )
        : leaderboard.slice(3);

    // Pagination
    const getStartIndex = (page) => (page === 1 ? 0 : firstPageSize + (page - 2) * normalPageSize);
    const currentPageSize = currentPage === 1 ? firstPageSize : normalPageSize;
    const startIndex = getStartIndex(currentPage);
    const paginatedOthers = filteredOthers.slice(startIndex, startIndex + currentPageSize);

    const totalPages = Math.ceil((filteredOthers.length - firstPageSize) / normalPageSize) + 1;

    const startRank = currentPage === 1 ? 4 : 4 + firstPageSize + (currentPage - 2) * normalPageSize;
    const endRank = Math.min(startRank + currentPageSize - 1, leaderboard.length);

    const getInitial = (player) => player.fullName?.trim()?.[0] || "?";

    const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        return d.toLocaleDateString("th-TH", {
            day: "numeric", month: "short", year: "numeric"
        });
    };

    // ==================== PODIUM ====================
    const PodiumBlock = ({ player, rank, height, className = "" }) => {
        const isFirst = rank === 1;
        return (
            <div className={`flex flex-col items-center w-full ${className}`}>
                <div className="relative z-10 -mb-4">
                    <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full ring-4 flex items-center justify-center
                        bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-4xl md:text-5xl
                        ${isFirst ? "ring-yellow-400 shadow-[0_0_30px_rgb(250,204,21,0.6)]" : "ring-white/30"}`}>
                        {getInitial(player)}
                    </div>
                    <div className={`absolute -top-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-lg
                        ${rank === 1 ? 'bg-yellow-400 text-black' : rank === 2 ? 'bg-slate-300 text-black' : 'bg-orange-400 text-white'}`}>
                        {rank}
                    </div>
                </div>

                <div className="text-center mb-3 z-10 mt-2">
                    <div className="font-bold text-xl md:text-2xl">{player.employeeId}</div>
                    <div className="text-yellow-400 font-mono text-sm">{player.score}/10 • {player.time}s</div>
                    <div className="text-xs text-white/60 mt-0.5">{formatDate(player.date)}</div>
                </div>

                <div className={`w-full rounded-t-2xl flex items-center justify-center bg-gradient-to-b from-yellow-300 to-yellow-500 shadow-xl relative ${height}`}>
                    <div className="text-[60px] md:text-[72px] font-black text-yellow-600 drop-shadow-md">{rank}</div>
                    {isFirst && <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-t-2xl" />}
                </div>
            </div>
        );
    };

    const PaginationControls = () => {
        if (totalPages <= 1) return null;

        return (
            <div className="flex flex-col items-center gap-3 mt-6">
                <div className="text-xs md:text-sm text-white/60 text-center">
                    แสดงอันดับ <span className="font-bold text-white">{startRank}</span> - <span className="font-bold text-white">{endRank}</span>
                    {" "}จากทั้งหมด <span className="font-bold text-white">{leaderboard.length}</span> คน
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-sm rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 transition"
                    >
                        ← ก่อนหน้า
                    </button>
                    <div className="px-4 py-2 bg-white/5 rounded-xl text-sm">
                        {currentPage} / {totalPages}
                    </div>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-sm rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 transition"
                    >
                        ถัดไป →
                    </button>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0F0A1F] text-white">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p>กำลังโหลดข้อมูล ... </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0F0A1F] text-white p-4 md:p-8">
            {/* Header */}
            <div className="text-center mb-8 md:mb-10">
                <h1 className="text-4xl md:text-6xl font-black tracking-tighter">Leaderboard</h1>
            </div>

            {/* Summary Stats */}
            <div className="max-w-3xl mx-auto mb-8">
                <div className="flex justify-center">
                    <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-6 py-3 text-sm md:text-base">
                        <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-bold text-lg">
                                ผ่าน {leaderboard.filter(p => p.score === 10).length} / {leaderboard.length} คน
                            </span>
                            <span className="text-emerald-400 font-semibold text-sm">
                                ({((leaderboard.filter(p => p.score === 10).length / leaderboard.length) * 100).toFixed(1)}%)
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* PODIUM */}
            <div className="max-w-5xl mx-auto mb-10">
                <div className="flex flex-col items-center gap-6 md:hidden">
                    {top3[0] && <PodiumBlock player={top3[0]} rank={1} height="h-40" />}
                    <div className="flex justify-center gap-4 w-full">
                        {top3[1] && <PodiumBlock player={top3[1]} rank={2} height="h-32" className="w-[48%]" />}
                        {top3[2] && <PodiumBlock player={top3[2]} rank={3} height="h-32" className="w-[48%]" />}
                    </div>
                </div>

                <div className="hidden md:flex items-end justify-center gap-4">
                    {top3[1] && <PodiumBlock player={top3[1]} rank={2} height="h-32" />}
                    {top3[0] && <PodiumBlock player={top3[0]} rank={1} height="h-52" />}
                    {top3[2] && <PodiumBlock player={top3[2]} rank={3} height="h-28" />}
                </div>
            </div>

            {/* Other Rankings */}
            <div className="max-w-3xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 px-1">
                    <h3 className="text-xl font-bold">Other Rankings</h3>

                    {/* ปุ่มรีเฟรช */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => fetchData(true)}
                            disabled={isRefreshing}
                            className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 transition"
                        >
                            {isRefreshing ? "กำลังรีเฟรช..." : "รีเฟรชข้อมูล"}
                        </button>

                        {/* ช่องค้นหา */}
                        <div className="relative w-full md:w-72">
                            <input
                                type="text"
                                placeholder="ค้นหารหัสพนักงาน..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 text-sm placeholder:text-white/50 focus:outline-none focus:border-yellow-400 transition"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-lg">×</button>
                            )}
                        </div>
                    </div>
                </div>

                {/* History View */}
                {searchedEmployeeId && employeeHistory.length > 0 ? (
                    <div className="bg-white/5 border border-yellow-400/30 rounded-3xl p-5 md:p-6 mb-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                            <div>
                                <div className="flex items-center gap-3">
                                    <span className="text-yellow-400 font-bold text-lg">ประวัติการทำแบบทดสอบ</span>
                                    <span className="font-mono text-2xl font-bold">{searchedEmployeeId}</span>
                                </div>
                                <div className="mt-1">
                                    <span className="text-sm text-white/60">ปัจจุบันอยู่อันดับ </span>
                                    <span className="font-bold text-yellow-400 text-xl">
                                        #{leaderboard.findIndex(p => p.employeeId === searchedEmployeeId) + 1}
                                    </span>
                                </div>
                            </div>
                            <div className="text-sm text-white/60">
                                ทั้งหมด <span className="font-bold text-white">{employeeHistory.length}</span> ครั้ง
                            </div>
                        </div>

                        <div className="space-y-2">
                            {employeeHistory.map((item, index) => (
                                <div key={index} className="flex flex-col md:flex-row md:items-center justify-between bg-white/5 rounded-2xl px-4 py-3 gap-y-1">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white/10 text-xs px-3 py-1 rounded-full font-mono w-fit">#{index + 1}</div>
                                        <div className="text-sm text-white/70">{formatDate(item.date)}</div>
                                    </div>
                                    <div className="flex items-center gap-6 font-mono text-sm md:text-base">
                                        <div><span className="font-bold">{item.score}</span><span className="text-white/40">/10</span></div>
                                        <div className="text-white/70">{item.time}s</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            {paginatedOthers.length > 0 ? (
                                paginatedOthers.map((p) => {
                                    const originalIndex = leaderboard.findIndex(item => item.employeeId === p.employeeId);
                                    const rank = originalIndex + 1;

                                    return (
                                        <div key={p.employeeId} className="flex items-center justify-between bg-white/5 hover:bg-white/10 transition rounded-2xl px-4 py-3 md:px-5 md:py-4 text-sm md:text-base">
                                            <div className="w-10 md:w-12 flex-shrink-0">
                                                <span className="font-mono font-bold text-lg md:text-xl text-white/70">#{rank}</span>
                                            </div>

                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="w-9 h-9 md:w-11 md:h-11 rounded-full ring-2 ring-white/20 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-lg md:text-xl flex-shrink-0">
                                                    {getInitial(p)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-semibold truncate">{p.employeeId}</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 md:gap-6 text-right">
                                                <div><span className="font-bold">{p.score}</span><span className="text-white/40">/10</span></div>
                                                <div className="text-white/60 w-12 md:w-14 text-right">{p.time}s</div>
                                            </div>

                                            <div className="hidden md:block text-right text-sm text-white/70 w-28 flex-shrink-0">
                                                {formatDate(p.date)}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8 text-white/50">ไม่พบรหัสพนักงานที่ค้นหา</div>
                            )}
                        </div>

                        <PaginationControls />
                    </>
                )}
            </div>
        </div>
    );
}