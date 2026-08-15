import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import multiavatar from "@multiavatar/multiavatar/esm";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../context/LanguageContext";

// ===== Cache ผล quiz_results ไว้ใน sessionStorage แบบมี TTL สั้น ๆ =====
// กันกรณีผู้ใช้กด refresh หน้ารัว ๆ แล้วยิง Supabase ซ้ำทุกครั้งโดยไม่จำเป็น
// (เคลียร์อัตโนมัติเมื่อปิดแท็บ, ข้อมูล Leaderboard เปลี่ยนเฉพาะตอนมีคนส่งผลสอบ
// จึงไม่จำเป็นต้อง fresh ทุกครั้งที่โหลดหน้า)
const LEADERBOARD_CACHE_KEY = "leaderboard_cache_v1";
const LEADERBOARD_CACHE_TTL_MS = 20_000; // 20 วินาที

const readLeaderboardCache = () => {
    try {
        const raw = sessionStorage.getItem(LEADERBOARD_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.fetchedAt || !Array.isArray(parsed?.data)) return null;
        if (Date.now() - parsed.fetchedAt > LEADERBOARD_CACHE_TTL_MS) return null;
        return parsed.data;
    } catch {
        return null;
    }
};

const writeLeaderboardCache = (data) => {
    try {
        sessionStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }));
    } catch {
        // sessionStorage เต็ม/ถูกปิด (เช่น private mode บางเบราว์เซอร์) → ข้ามเงียบ ๆ ไม่กระทบการทำงานหลัก
    }
};

export default function PodiumLeaderboard() {
    const navigate = useNavigate();
    const { t, lang } = useLanguage();
    const [allAttempts, setAllAttempts] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [mounted, setMounted] = useState(false); // สำหรับ animation ตอนโหลดเสร็จ

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    // Other Rankings หน้าแรกแสดงลำดับ 4-10 (ต่อจาก podium 3 อันดับแรกพอดี = 7 คน)
    // หน้า 2 เป็นต้นไปแสดงครั้งละ 10 อันดับ (11-20, 21-30, ...) ต่อเนื่องไม่มีช่วงขาด
    const firstPageSize = 7;
    const normalPageSize = 10;

    const parseDateTime = (dateStr) => {
        if (!dateStr) return 0;
        return new Date(dateStr.replace(" ", "T")).getTime();
    };

    const fetchData = async (isManualRefresh = false) => {
        if (isManualRefresh) setIsRefreshing(true);

        try {
            // refresh ปกติ (ไม่ใช่กดปุ่ม refresh เอง) ให้ลองใช้ cache ก่อน
            // กันกรณีผู้ใช้กด F5 รัว ๆ ยิง Supabase ซ้ำโดยไม่จำเป็น
            const cached = !isManualRefresh ? readLeaderboardCache() : null;
            let mapped;

            if (cached) {
                mapped = cached;
            } else {
                const { data, error } = await supabase
                    .from("quiz_results")
                    .select("employee_id, score, time, comment, created_at");

                if (error) throw error;

                // แปลงชื่อ field ให้เหมือนโค้ดเดิม
                mapped = data.map(item => ({
                    employeeId: item.employee_id,
                    score: item.score,
                    time: item.time,
                    comment: item.comment,
                    date: item.created_at,
                }));

                writeLeaderboardCache(mapped);
            }

            setAllAttempts(mapped);

            const bestMap = {};

            mapped.forEach(item => {
                const id = item.employeeId;

                if (!bestMap[id]) {
                    bestMap[id] = item;
                } else {
                    const current = bestMap[id];

                    const isBetter =
                        item.score > current.score ||
                        (item.score === current.score &&
                            item.time < current.time) ||
                        (item.score === current.score &&
                            item.time === current.time &&
                            parseDateTime(item.date) <
                            parseDateTime(current.date));

                    if (isBetter) {
                        bestMap[id] = item;
                    }
                }
            });

            const sorted = Object.values(bestMap).sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (a.time !== b.time) return a.time - b.time;
                return parseDateTime(a.date) - parseDateTime(b.date);
            });

            setLeaderboard(sorted);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            if (isManualRefresh) setIsRefreshing(false);
            setTimeout(() => setMounted(true), 50);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // ==================== อนุภาคลอย (particles) พื้นหลัง ====================
    const particles = useMemo(() =>
        Array.from({ length: 24 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            size: 2 + Math.random() * 4,
            duration: 8 + Math.random() * 12,
            delay: Math.random() * 10,
            emoji: Math.random() > 0.7 ? ["✦", "✧", "⭐", "✨"][Math.floor(Math.random() * 4)] : null,
        })), []);

    // ==================== Podium: เฉพาะคนที่ได้ 10/10 เท่านั้น ====================
    const top3 = leaderboard.filter(p => p.score === 10).slice(0, 3);
    const top3Ids = new Set(top3.map(p => p.employeeId));

    // ที่เหลือทั้งหมด (รวมคนที่ยังไม่ผ่านทุกคน) → Other Rankings
    const othersBase = leaderboard.filter(p => !top3Ids.has(p.employeeId));

    const searchLower = searchTerm.trim().toLowerCase();

    const searchedEmployeeId = allAttempts.find(p =>
        String(p.employeeId || '').toLowerCase() === searchLower
    )?.employeeId || null;

    const employeeHistory = searchedEmployeeId
        ? allAttempts
            .filter(p => String(p.employeeId || '').toLowerCase() === searchLower)
            .sort((a, b) => parseDateTime(b.date) - parseDateTime(a.date))
        : [];

    const filteredOthers = searchTerm.trim()
        ? othersBase.filter(p =>
            String(p.employeeId || '').toLowerCase().includes(searchLower)
        )
        : othersBase;

    // Pagination
    const getStartIndex = (page) => (page === 1 ? 0 : firstPageSize + (page - 2) * normalPageSize);
    const currentPageSize = currentPage === 1 ? firstPageSize : normalPageSize;
    const startIndex = getStartIndex(currentPage);
    const paginatedOthers = filteredOthers.slice(startIndex, startIndex + currentPageSize);

    const totalPages = Math.max(1, Math.ceil((filteredOthers.length - firstPageSize) / normalPageSize) + 1);

    // อันดับจริงจาก leaderboard ตัวเต็ม (ไม่ hardcode ว่าเริ่มที่ #4)
    // จัดอันดับเฉพาะคนที่ได้ 10/10 เท่านั้น คนที่ยังไม่ผ่านไม่มีอันดับ (แสดง "-")
    const rankOf = (p) => {
        if (p.score !== 10) return null;
        return leaderboard.findIndex(item => item.employeeId === p.employeeId) + 1;
    };
    const rankedOnPage = paginatedOthers.map(rankOf).filter(r => r !== null);
    const startRank = rankedOnPage.length > 0 ? rankedOnPage[0] : null;
    const endRank = rankedOnPage.length > 0 ? rankedOnPage[rankedOnPage.length - 1] : null;

    // ==================== Avatar การ์ตูน (multiavatar - generate ในเครื่อง ไม่พึ่ง API ภายนอก) ====================
    // seed = employeeId → คนเดิมได้ตัวการ์ตูนตัวเดิมเสมอ ไม่เปลี่ยนตอนรีเฟรช
    const avatarCache = useMemo(() => new Map(), []);

    const getAvatarSvg = (player) => {
        const seed = String(player.employeeId || "?");
        if (!avatarCache.has(seed)) {
            avatarCache.set(seed, multiavatar(seed));
        }
        return avatarCache.get(seed);
    };

    const Avatar3D = ({ player, className = "" }) => (
        <div
            className={`overflow-hidden [&>svg]:w-full [&>svg]:h-full ${className}`}
            dangerouslySetInnerHTML={{ __html: getAvatarSvg(player) }}
        />
    );

    const formatDate = (dateStr) => {
        if (!dateStr) return "-";

        const d = new Date(dateStr.replace(" ", "T"));

        return d.toLocaleString(lang === "en" ? "en-GB" : "th-TH", {
            timeZone: "Asia/Bangkok",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
    };

    // ==================== ป้ายสถานะ Pass / Not Pass ====================
    const StatusBadge = ({ score, size = "md" }) => {
        const isPass = score === 10;
        const sizeClass = size === "sm"
            ? "px-2 py-0.5 text-[10px] gap-1"
            : "px-2.5 py-1 text-[11px] md:text-xs gap-1.5";

        return isPass ? (
            <span className={`inline-flex items-center ${sizeClass} rounded-full font-bold uppercase tracking-wide
                bg-emerald-400/15 text-emerald-300 border border-emerald-400/40
                shadow-[0_0_12px_rgba(16,185,129,0.25)]`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
                {t("home.statusPass")}
            </span>
        ) : (
            <span className={`inline-flex items-center ${sizeClass} rounded-full font-bold uppercase tracking-wide
                bg-rose-500/10 text-rose-300 border border-rose-400/40`}
                title={t("home.notPassTitle")}>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                {t("home.statusNotPass")}
            </span>
        );
    };

    // ==================== แถวอันดับ (ใช้ร่วมกันทั้ง Other Rankings และผลค้นหา) ====================
    const RankRow = ({ player, rank, delay = 0 }) => {
        const isTop10 = rank !== null && rank <= 10;
        const isPass = player.score === 10;

        // การ์ด Not Pass เท่านั้นที่คลิกได้ → ไปหน้า Quiz พร้อมเติมรหัสพนักงานให้
        // (แค่เติมให้ ไม่ auto เริ่มทำ ผู้ใช้ต้องกด "เริ่มทำแบบทดสอบ" เองอีกที)
        const handleRowClick = () => {
            if (isPass) return;
            navigate(`/quiz?employeeId=${encodeURIComponent(player.employeeId)}`);
        };

        return (
            <div
                onClick={!isPass ? handleRowClick : undefined}
                role={!isPass ? "button" : undefined}
                tabIndex={!isPass ? 0 : undefined}
                onKeyDown={!isPass ? (e) => { if (e.key === "Enter" || e.key === " ") handleRowClick(); } : undefined}
                title={!isPass ? t("home.clickToRetryTitle") : undefined}
                className={`flex items-center justify-between backdrop-blur transition-all duration-300 rounded-2xl px-4 py-2.5 md:px-5 md:py-3 text-sm md:text-base
                    hover:scale-[1.02]
                    ${!isPass ? "cursor-pointer" : ""}
                    ${isPass
                        ? "hover:shadow-[0_0_20px_rgba(16,185,129,0.25)] " + (isTop10
                            ? "bg-gradient-to-r from-emerald-500/10 via-purple-500/10 to-white/5 border border-emerald-400/25 hover:bg-emerald-500/10"
                            : "bg-white/5 border border-emerald-400/15 hover:bg-white/10")
                        : "bg-white/[0.03] border border-rose-400/15 hover:bg-rose-500/[0.07] hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]"}`}
                style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "translateX(0)" : "translateX(-20px)",
                    transition: `all 0.4s ease ${Math.min(delay * 0.04, 0.6)}s`,
                }}>
                <div className="w-10 md:w-12 flex-shrink-0">
                    <span className={`font-mono font-bold text-lg md:text-xl ${isTop10 ? "text-yellow-400" : "text-white/70"}`}>{rank !== null ? `#${rank}` : "-"}</span>
                </div>

                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 md:w-11 md:h-11 rounded-full ring-2 overflow-hidden flex-shrink-0
                        ${isPass ? "ring-emerald-400/50" : "ring-white/15 grayscale-[35%] opacity-90"}`}>
                        <Avatar3D player={player} className="w-full h-full rounded-full" />
                    </div>
                    <div className="min-w-0">
                        <div className={`font-semibold truncate ${!isPass ? "text-white/80" : ""}`}>
                            {player.employeeId}
                           
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                            <StatusBadge score={player.score} size="sm" />
                            {!isPass && (
                                <span className="hidden md:inline text-[10px] text-white/40">
                                    {t("home.clickToRetry")}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 md:gap-6 text-right">
                    <div>
                        <span className={`font-bold ${isPass ? "text-emerald-300" : "text-rose-300"}`}>{player.score}</span>
                        <span className="text-white/40">/10</span>
                    </div>
                    <div className="text-white/60 w-12 md:w-14 text-right">{player.time}s</div>
                </div>

                <div className="hidden md:block text-right text-sm text-white/70 w-28 flex-shrink-0">
                    {formatDate(player.date)}
                </div>
            </div>
        );
    };

    // ==================== มงกุฎ SVG ====================
    const Crown = ({ className = "" }) => (
        <svg viewBox="0 0 64 44" className={className} fill="none">
            <path d="M6 36 L2 12 L18 24 L32 4 L46 24 L62 12 L58 36 Z"
                fill="url(#crownGrad)" stroke="#B45309" strokeWidth="1.5" strokeLinejoin="round" />
            <rect x="6" y="36" width="52" height="6" rx="2" fill="url(#crownGrad)" stroke="#B45309" strokeWidth="1.5" />
            <circle cx="32" cy="16" r="3" fill="#EF4444" stroke="#B45309" />
            <circle cx="16" cy="28" r="2.2" fill="#3B82F6" stroke="#B45309" />
            <circle cx="48" cy="28" r="2.2" fill="#10B981" stroke="#B45309" />
            <defs>
                <linearGradient id="crownGrad" x1="0" y1="0" x2="0" y2="44">
                    <stop offset="0%" stopColor="#FDE68A" />
                    <stop offset="50%" stopColor="#FBBF24" />
                    <stop offset="100%" stopColor="#D97706" />
                </linearGradient>
            </defs>
        </svg>
    );

    // ==================== ธีมสีของแต่ละอันดับ ====================
    const rankTheme = {
        1: {
            ring: "ring-yellow-400",
            glow: "shadow-[0_0_50px_rgba(250,204,21,0.8)]",
            podium: "from-yellow-300 via-amber-400 to-yellow-600",
            badge: "bg-gradient-to-br from-yellow-300 to-amber-500 text-black",
            avatar: "from-amber-400 via-orange-500 to-rose-500",
            numColor: "text-yellow-700",
            aura: "rgba(250,204,21,0.35)",
            medal: "🥇",
        },
        2: {
            ring: "ring-slate-300",
            glow: "shadow-[0_0_35px_rgba(203,213,225,0.5)]",
            podium: "from-slate-200 via-slate-300 to-slate-500",
            badge: "bg-gradient-to-br from-slate-200 to-slate-400 text-black",
            avatar: "from-sky-400 via-indigo-500 to-purple-600",
            numColor: "text-slate-600",
            aura: "rgba(203,213,225,0.25)",
            medal: "🥈",
        },
        3: {
            ring: "ring-orange-400",
            glow: "shadow-[0_0_35px_rgba(251,146,60,0.5)]",
            podium: "from-orange-300 via-orange-400 to-amber-700",
            badge: "bg-gradient-to-br from-orange-300 to-amber-600 text-white",
            avatar: "from-rose-400 via-pink-500 to-purple-600",
            numColor: "text-orange-800",
            aura: "rgba(251,146,60,0.25)",
            medal: "🥉",
        },
    };

    // ==================== PODIUM ====================
    const PodiumBlock = ({ player, rank, height, className = "" }) => {
        const isFirst = rank === 1;
        const t = rankTheme[rank];
        const delays = { 1: "0.5s", 2: "0.2s", 3: "0.35s" };

        return (
            <div className={`flex flex-col items-center w-full ${className}`}
                style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "translateY(0)" : "translateY(40px)",
                    transition: `all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${delays[rank]}`,
                }}>

                {/* มงกุฎเฉพาะอันดับ 1 */}
                {isFirst && (
                    <div className="relative z-20 -mb-3 animate-crown-float">
                        <Crown className="w-16 h-11 md:w-20 md:h-14 drop-shadow-[0_0_15px_rgba(250,204,21,0.9)]" />
                    </div>
                )}

                <div className="relative z-10 -mb-4">
                    {/* รัศมีหมุนรอบอันดับ 1 */}
                    {isFirst && (
                        <div className="absolute -inset-4 rounded-full animate-spin-slow opacity-70"
                            style={{
                                background: `conic-gradient(from 0deg, transparent, ${t.aura}, transparent, ${t.aura}, transparent)`,
                            }} />
                    )}

                    <div className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full ring-4 overflow-hidden
                        ${t.ring} ${t.glow} ${isFirst ? "animate-pulse-glow" : ""}`}>
                        <Avatar3D player={player} className="w-full h-full rounded-full" />
                        {/* ประกายวิ้งบนอวตาร */}
                        <span className="absolute top-1 right-2 text-white/90 text-xs animate-twinkle pointer-events-none">✦</span>
                        <span className="absolute bottom-2 left-1 text-white/70 text-[10px] animate-twinkle pointer-events-none" style={{ animationDelay: "0.7s" }}>✦</span>
                    </div>

                    <div className={`absolute -top-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center text-lg shadow-lg ${t.badge} animate-badge-pop`}>
                        {t.medal}
                    </div>
                </div>

                <div className="text-center mb-3 z-10 mt-3">
                    <div className={`font-bold text-xl md:text-2xl ${isFirst ? "animate-shimmer-text" : ""}`}>{player.employeeId}</div>
                    <div className="text-yellow-400 font-mono text-sm font-bold">{player.score}/10 • {player.time}s</div>
                    <div className="text-xs text-white/60 mt-0.5">{formatDate(player.date)}</div>
                </div>

                {/* แท่นโพเดียม */}
                <div className={`w-full rounded-t-2xl flex items-center justify-center bg-gradient-to-b ${t.podium} shadow-2xl relative overflow-hidden ${height}`}
                    style={{
                        transformOrigin: "bottom",
                        transform: mounted ? "scaleY(1)" : "scaleY(0)",
                        transition: `transform 0.9s cubic-bezier(0.34, 1.4, 0.64, 1) ${delays[rank]}`,
                    }}>
                    <div className={`text-[60px] md:text-[72px] font-black ${t.numColor} drop-shadow-md`}>{rank}</div>
                    {/* แสงวิ่งผ่าน */}
                    <div className="absolute inset-0 animate-sheen"
                        style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.5) 50%, transparent 60%)" }} />
                    {isFirst && <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-t-2xl" />}
                </div>
            </div>
        );
    };

    const PaginationControls = () => {
        if (totalPages <= 1) return null;

        return (
            <div className="flex flex-col items-center gap-3 mt-4">
            

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-sm rounded-xl bg-white/10 hover:bg-white/20 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 transition-all"
                    >
                        {t("home.prevPage")}
                    </button>
                    <div className="px-4 py-2 bg-white/5 rounded-xl text-sm">
                        {currentPage} / {totalPages}
                    </div>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-sm rounded-xl bg-white/10 hover:bg-white/20 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 transition-all"
                    >
                        {t("home.nextPage")}
                    </button>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0F0A1F] text-white">
                <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-2 border-4 border-purple-500 border-b-transparent rounded-full animate-spin" style={{ animationDirection: "reverse" }}></div>
                        <div className="absolute inset-0 flex items-center justify-center text-xl">🏆</div>
                    </div>
                    <p className="animate-pulse">{t("home.loading")}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen text-white p-4 md:p-8 relative overflow-hidden"
            style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, #2d1b69 0%, #0F0A1F 60%)" }}>

            {/* ===== CSS Animations ===== */}
            <style>{`
                @keyframes crownFloat {
                    0%, 100% { transform: translateY(0) rotate(-3deg); }
                    50% { transform: translateY(-8px) rotate(3deg); }
                }
                @keyframes spinSlow {
                    to { transform: rotate(360deg); }
                }
                @keyframes pulseGlow {
                    0%, 100% { box-shadow: 0 0 40px rgba(250,204,21,0.7); }
                    50% { box-shadow: 0 0 70px rgba(250,204,21,1), 0 0 100px rgba(250,204,21,0.5); }
                }
                @keyframes twinkle {
                    0%, 100% { opacity: 0.2; transform: scale(0.7); }
                    50% { opacity: 1; transform: scale(1.2); }
                }
                @keyframes sheen {
                    0% { transform: translateX(-100%); }
                    60%, 100% { transform: translateX(100%); }
                }
                @keyframes shimmerText {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                @keyframes badgePop {
                    0% { transform: scale(0) rotate(-30deg); }
                    70% { transform: scale(1.3) rotate(10deg); }
                    100% { transform: scale(1) rotate(0); }
                }
                @keyframes floatUp {
                    0% { transform: translateY(105vh); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(-10vh); opacity: 0; }
                }
                @keyframes titleGlow {
                    0%, 100% { text-shadow: 0 0 20px rgba(250,204,21,0.4), 0 0 60px rgba(168,85,247,0.3); }
                    50% { text-shadow: 0 0 40px rgba(250,204,21,0.8), 0 0 90px rgba(168,85,247,0.6); }
                }
                @keyframes auroraDrift {
                    0%, 100% { transform: translateX(-15%) scale(1); opacity: 0.5; }
                    50% { transform: translateX(15%) scale(1.15); opacity: 0.9; }
                }
                @keyframes gradientShift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @keyframes footerBounce {
                    0%, 100% { transform: translateY(0) rotate(-4deg); }
                    50% { transform: translateY(-10px) rotate(4deg); }
                }
                @keyframes borderRun {
                    to { transform: rotate(360deg); }
                }
                @keyframes waveLine {
                    0%, 100% { transform: scaleX(0.6); opacity: 0.5; }
                    50% { transform: scaleX(1); opacity: 1; }
                }
                .animate-crown-float { animation: crownFloat 3s ease-in-out infinite; }
                .animate-spin-slow { animation: spinSlow 6s linear infinite; }
                .animate-pulse-glow { animation: pulseGlow 2.5s ease-in-out infinite; }
                .animate-twinkle { animation: twinkle 1.8s ease-in-out infinite; }
                .animate-sheen { animation: sheen 3.5s ease-in-out infinite; }
                .animate-badge-pop { animation: badgePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 1s backwards; }
                .animate-title-glow { animation: titleGlow 3s ease-in-out infinite; }
                .animate-aurora { animation: auroraDrift 8s ease-in-out infinite; }
                .animate-gradient-shift {
                    background-size: 300% 300%;
                    animation: gradientShift 6s ease infinite;
                }
                .animate-footer-bounce { animation: footerBounce 2.8s ease-in-out infinite; }
                .animate-wave-line { animation: waveLine 3s ease-in-out infinite; transform-origin: center; }
                .footer-glass-border { position: relative; overflow: hidden; }
                .footer-glass-border::before {
                    content: "";
                    position: absolute;
                    inset: -150%;
                    background: conic-gradient(from 0deg,
                        transparent 0deg, transparent 60deg,
                        rgba(250,204,21,0.9) 90deg,
                        rgba(168,85,247,0.9) 130deg,
                        transparent 170deg, transparent 240deg,
                        rgba(16,185,129,0.8) 280deg,
                        transparent 330deg);
                    animation: borderRun 5s linear infinite;
                }
                .footer-glass-border::after {
                    content: "";
                    position: absolute;
                    inset: 2px;
                    border-radius: inherit;
                    background: rgba(15,10,31,0.92);
                }
                .animate-shimmer-text {
                    background: linear-gradient(90deg, #fff 40%, #fde047 50%, #fff 60%);
                    background-size: 200% auto;
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: shimmerText 3s linear infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                    *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
                }
            `}</style>

            {/* ===== อนุภาคลอยพื้นหลัง ===== */}
            <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
                {particles.map(p => (
                    <div key={p.id}
                        className="absolute"
                        style={{
                            left: `${p.left}%`,
                            bottom: 0,
                            animation: `floatUp ${p.duration}s linear ${p.delay}s infinite`,
                        }}>
                        {p.emoji ? (
                            <span className="text-yellow-300/60" style={{ fontSize: p.size * 3 }}>{p.emoji}</span>
                        ) : (
                            <div className="rounded-full bg-purple-400/40"
                                style={{ width: p.size, height: p.size, boxShadow: "0 0 8px rgba(168,85,247,0.6)" }} />
                        )}
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="text-center mb-5 relative z-10">
                <div className="text-4xl mb-1 animate-crown-float inline-block">🏆</div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter animate-title-glow bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 bg-clip-text text-transparent">
                    LEADERBOARD
                </h1>
                <div className="flex items-center justify-center gap-2 mt-1 text-yellow-400/70 text-sm">
                    <span className="animate-twinkle">✦</span>
                    <span>{t("home.hallOfFame")}</span>
                    <span className="animate-twinkle" style={{ animationDelay: "0.9s" }}>✦</span>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="max-w-3xl mx-auto mb-6 relative z-10">
                <div className="flex justify-center">
                    <div className="flex items-center gap-4 bg-white/5 backdrop-blur border border-emerald-400/30 rounded-2xl px-5 py-2.5 text-sm md:text-base shadow-[0_0_25px_rgba(16,185,129,0.15)]">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🎯</span>
                            <span className="text-emerald-400 font-bold text-lg">
                                {t("home.passedCount")(leaderboard.filter(p => p.score === 10).length, leaderboard.length)}
                            </span>
                            <span className="text-emerald-400 font-semibold text-sm">
                                ({leaderboard.length > 0 ? ((leaderboard.filter(p => p.score === 10).length / leaderboard.length) * 100).toFixed(1) : 0}%)
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* PODIUM — แสดงเฉพาะคนที่ได้ 10/10 */}
            <div className="max-w-5xl mx-auto mb-6 relative z-10">
                {top3.length > 0 ? (
                    <>
                        <div className="flex flex-col items-center gap-4 md:hidden">
                            {top3[0] && <PodiumBlock player={top3[0]} rank={1} height="h-32" />}
                            <div className="flex justify-center gap-4 w-full">
                                {top3[1] && <PodiumBlock player={top3[1]} rank={2} height="h-24" className="w-[48%]" />}
                                {top3[2] && <PodiumBlock player={top3[2]} rank={3} height="h-24" className="w-[48%]" />}
                            </div>
                        </div>

                        <div className="hidden md:flex items-end justify-center gap-4">
                            {top3[1] && <PodiumBlock player={top3[1]} rank={2} height="h-24" />}
                            {top3[0] && <PodiumBlock player={top3[0]} rank={1} height="h-40" />}
                            {top3[2] && <PodiumBlock player={top3[2]} rank={3} height="h-20" />}
                        </div>

                        {/* พื้นเวทีเรืองแสงใต้โพเดียม */}
                        <div className="hidden md:block h-2 max-w-3xl mx-auto rounded-full"
                            style={{ background: "linear-gradient(90deg, transparent, rgba(250,204,21,0.5), transparent)", filter: "blur(2px)" }} />
                    </>
                ) : (
                    <div className="text-center py-7 bg-white/5 backdrop-blur border border-yellow-400/20 rounded-3xl">
                        <div className="text-5xl mb-3">🏆</div>
                        <div className="text-lg font-bold text-yellow-300">{t("home.noWinnerTitle")}</div>
                        <div className="text-sm text-white/60 mt-1">{t("home.noWinnerBody")}</div>
                    </div>
                )}
            </div>

            {/* Other Rankings */}
            <div className="max-w-3xl mx-auto relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 px-1">
                    <h3 className="text-xl font-bold flex items-center gap-2">{t("home.otherRankings")}</h3>

                    <div className="flex items-center gap-3">


                        <div className="relative w-full md:w-72">
                            <input
                                type="text"
                                placeholder={t("home.searchPlaceholder")}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 text-sm placeholder:text-white/50 focus:outline-none focus:border-yellow-400 focus:shadow-[0_0_20px_rgba(250,204,21,0.3)] transition-all"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-lg">×</button>
                            )}
                        </div>
                    </div>
                </div>

                {/* min-h กันหน้าจอกระโดด ตอนสลับระหว่างลิสต์เต็ม ↔ ผลค้นหา (ที่มีจำนวนแถวไม่เท่ากัน) */}
                <div className="min-h-[520px] md:min-h-[640px]">
                    {/* History View — การ์ดแบบเดียวกับ Other Rankings เพื่อความสม่ำเสมอทั้งหน้า */}
                    {searchedEmployeeId && employeeHistory.length > 0 ? (
                        <div className="mb-6">
                            <div className="space-y-2">
                                {employeeHistory.map((item, idx) => (
                                    <RankRow key={idx} player={item} rank={rankOf(item)} delay={idx} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                {paginatedOthers.length > 0 ? (
                                    paginatedOthers.map((p, idx) => (
                                        <RankRow key={p.employeeId} player={p} rank={rankOf(p)} delay={idx} />
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-white/50">{t("home.noSearchResult")}</div>
                                )}
                            </div>

                            <PaginationControls />
                        </>
                    )}
                </div>
            </div>

            {/* ==================== FOOTER ==================== */}
            <footer className="relative z-10 mt-8 md:mt-10  ">
                {/* aurora glow ด้านหลัง footer */}
                <div className="absolute inset-x-0 bottom-0 h-40 pointer-events-none overflow-hidden" aria-hidden="true">
                    <div className="absolute bottom-[-60px] left-[10%] w-[320px] h-[160px] rounded-full blur-3xl animate-aurora"
                        style={{ background: "radial-gradient(ellipse, rgba(168,85,247,0.3), transparent 70%)" }} />
                    <div className="absolute bottom-[-40px] right-[8%] w-[300px] h-[150px] rounded-full blur-3xl animate-aurora"
                        style={{ background: "radial-gradient(ellipse, rgba(250,204,21,0.18), transparent 70%)", animationDelay: "2.5s" }} />
                </div>

      
         
            </footer>
        </div>
    );
}