import { useState } from "react";
import { FileSpreadsheet, Lock, Download } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../context/LanguageContext";

const REPORT_PASSWORD = "12345!";

// อ่านปี/เดือน/วัน/ชม./นาที/วิ ของเวลาไทย (UTC+7) จาก Date object ใด ๆ
const getBangkokParts = (date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
    return {
        year: get("year"),
        month: get("month"),
        day: get("day"),
        hour: get("hour"),
        minute: get("minute"),
        second: get("second"),
    };
};

// แปลงเวลาจาก Supabase (เก็บเป็น UTC) ให้เป็นเวลาไทย (UTC+7) รูปแบบ YYYY-MM-DD HH:mm:ss
const formatBangkokTime = (isoString) => {
    if (!isoString) return "";
    const p = getBangkokParts(new Date(isoString));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
};

// ชื่อไฟล์ report_YYYYMMDD_HHmmss.xlsx ตามวันเวลาที่กดดาวน์โหลดจริง (เวลาไทย)
const buildReportFilename = (date) => {
    const p = getBangkokParts(date);
    return `report_${p.year}${p.month}${p.day}_${p.hour}${p.minute}${p.second}.xlsx`;
};

export default function Report() {
    const { t } = useLanguage();
    const [password, setPassword] = useState("");
    const [unlocked, setUnlocked] = useState(false);
    const [passwordError, setPasswordError] = useState("");
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState("");

    const handleCheckPassword = (e) => {
        e.preventDefault();
        if (password === REPORT_PASSWORD) {
            setUnlocked(true);
            setPasswordError("");
        } else {
            setPasswordError(t("report.passwordError"));
        }
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        setDownloadError("");

        try {
            // โหลด exceljs เฉพาะตอนกดดาวน์โหลดจริง ๆ (dynamic import) กันไม่ให้
            // ไลบรารีขนาดใหญ่นี้ไปรวมอยู่ใน bundle หลักที่พนักงานทุกคนต้องโหลด
            // ตอนเข้าเว็บ ทั้งที่มีแค่คนที่มาหน้า Report เท่านั้นที่ใช้งาน
            const [{ data, error }, { default: ExcelJS }] = await Promise.all([
                supabase
                    .from("quiz_results")
                    .select("employee_id, score, time, comment, created_at")
                    .order("score", { ascending: false })
                    .order("time", { ascending: true }),
                import("exceljs"),
            ]);

            if (error) throw error;

            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet("Report");

            sheet.columns = [
                { header: t("report.colNo"), key: "no", width: 8 },
                { header: t("report.colEmployeeId"), key: "employeeId", width: 20 },
                { header: t("report.colScore"), key: "score", width: 10 },
                { header: t("report.colTime"), key: "time", width: 18 },
                { header: t("report.colComment"), key: "comment", width: 50 },
                { header: t("report.colCreatedAt"), key: "createdAt", width: 22 },
            ];
            sheet.getRow(1).font = { bold: true };

            (data ?? []).forEach((row, i) => {
                sheet.addRow({
                    no: i + 1,
                    employeeId: row.employee_id,
                    score: row.score,
                    time: row.time,
                    comment: row.comment,
                    createdAt: formatBangkokTime(row.created_at),
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = buildReportFilename(new Date());
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            setDownloadError(t("report.downloadError"));
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div
            className="min-h-screen text-white p-6 md:p-8 flex items-start justify-center"
            style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, #2d1b69 0%, #0F0A1F 60%)" }}
        >
            <div className="max-w-md w-full mt-10 md:mt-16">
                <h1 className="text-4xl md:text-5xl font-black text-center mb-2">{t("report.title")}</h1>
                <p className="text-center text-white/60 mb-8">{t("report.subtitle")}</p>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-sm">
                    {!unlocked ? (
                        <form onSubmit={handleCheckPassword}>
                            <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-2">
                                <Lock size={16} /> {t("report.passwordLabel")}
                            </label>

                            <input
                                type="password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setPasswordError("");
                                }}
                                placeholder={t("report.passwordPlaceholder")}
                                className={`w-full rounded-2xl bg-white/10 border px-4 py-3 text-white placeholder:text-white/40 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 ${passwordError ? "border-red-500" : "border-white/20"
                                    }`}
                            />

                            {passwordError && (
                                <div className="text-red-400 text-sm mt-2">⚠️ {passwordError}</div>
                            )}

                            <button
                                type="submit"
                                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold py-3.5 transition-all duration-300 hover:scale-[1.02]"
                            >
                                {t("report.confirm")}
                            </button>
                        </form>
                    ) : (
                        <div className="text-center">
                            <FileSpreadsheet className="mx-auto mb-4 text-emerald-400" size={48} />
                            <p className="text-white/70 mb-6">
                                {t("report.downloadDesc")}
                            </p>

                            {downloadError && (
                                <div className="text-red-400 text-sm mb-4">⚠️ {downloadError}</div>
                            )}

                            <button
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3.5 transition-all duration-300 hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                            >
                                <Download size={20} />
                                {isDownloading ? t("report.preparing") : t("report.downloadButton")}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
