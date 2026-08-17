import { useState } from "react";
import { FileSpreadsheet, Lock, Download, Upload, FileCheck2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../context/LanguageContext";

const REPORT_PASSWORD = "12345!";

// ชื่อชีทที่ต้องมีในไฟล์ข้อมูลพนักงานที่อัปโหลด (ต้องตรงกับที่ HR ใช้ส่งออกข้อมูล)
const EMPLOYEE_SHEET_NAME = "ข้อมูลพนักงาน";

// คอลัมน์ที่ต้องดึงจากชีทข้อมูลพนักงาน อ้างอิงด้วย "ชื่อหัวตาราง" ไม่ใช่ตำแหน่งคอลัมน์
// กันปัญหาไฟล์ที่อัปโหลดมาสลับลำดับคอลัมน์ หรือมีคอลัมน์เพิ่ม/หายไปจากไฟล์ต้นแบบ
const EMPLOYEE_COLUMN_KEYS = ["emId", "prefixNameTh", "firstnameTh", "lastnameTh", "companyName", "sectionName"];

// อ่านค่าจากเซลล์ ExcelJS ให้ออกมาเป็น string/number ธรรมดาเสมอ ไม่ว่าเซลล์จะเก็บเป็น
// ข้อความ ตัวเลข วันที่ หรือ rich text/สูตรที่มี cached result มาด้วยก็ตาม
const cellText = (cell) => {
    const v = cell?.value;
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "object") {
        if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
        if (v.text !== undefined) return String(v.text);
        if (v.result !== undefined) return String(v.result);
        return "";
    }
    return String(v);
};

// ตัดช่องว่างหัวท้าย + ทำเป็นตัวพิมพ์ใหญ่ ให้ตรงกับรูปแบบที่ระบบเก็บ employee_id ไว้
// (Quiz.jsx จะ trim().toUpperCase() รหัสพนักงานก่อนบันทึกลง Supabase เสมอ)
const normalizeKey = (raw) => String(raw ?? "").trim().toUpperCase();

// รหัสตัวเลขล้วนบางไฟล์ถูกเก็บเป็น "ตัวเลข" ใน Excel ทำให้เลข 0 นำหน้าหายไป
// (เช่น "02002" กลายเป็น 2002) จึงต้องมีคีย์สำรองแบบตัดเลข 0 นำหน้าออก ไว้จับคู่ข้ามรูปแบบกัน
const numericAltKey = (normalizedKey) => (/^\d+$/.test(normalizedKey) ? String(parseInt(normalizedKey, 10)) : null);

const findEmployeeSheet = (workbook) => {
    const exact = workbook.worksheets.find((ws) => ws.name.trim() === EMPLOYEE_SHEET_NAME);
    if (exact) return exact;
    return workbook.worksheets.find((ws) => ws.name.trim().toLowerCase() === EMPLOYEE_SHEET_NAME.toLowerCase()) ?? null;
};

// สแกนแถวหัวตาราง (แถว 1) หาว่าแต่ละคอลัมน์ที่ต้องการอยู่ตำแหน่งไหน โดยจับคู่จาก "ชื่อ" ไม่ใช่ตำแหน่ง
const buildColumnIndexMap = (headerRow, keys) => {
    const map = {};
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const text = cellText(cell).trim();
        keys.forEach((k) => {
            if (map[k] === undefined && text === k) map[k] = colNumber;
        });
    });
    // เผื่อไฟล์ที่อัปโหลดสะกดตัวพิมพ์เล็ก/ใหญ่ต่างไปเล็กน้อย ลองจับคู่แบบไม่สนตัวพิมพ์อีกรอบ
    keys.forEach((k) => {
        if (map[k] !== undefined) return;
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            if (map[k] !== undefined) return;
            if (cellText(cell).trim().toLowerCase() === k.toLowerCase()) map[k] = colNumber;
        });
    });
    return map;
};

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

// ชื่อไฟล์ summary_YYYYMMDD_HHmmss.xlsx สำหรับรายงานสรุปผลที่เทียบกับไฟล์ข้อมูลพนักงาน
const buildSummaryFilename = (date) => {
    const p = getBangkokParts(date);
    return `summary_${p.year}${p.month}${p.day}_${p.hour}${p.minute}${p.second}.xlsx`;
};

export default function Report() {
    const { t } = useLanguage();
    const [password, setPassword] = useState("");
    const [unlocked, setUnlocked] = useState(false);
    const [passwordError, setPasswordError] = useState("");
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState("");

    const [employeeFile, setEmployeeFile] = useState(null);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [summaryError, setSummaryError] = useState("");

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

    const handleEmployeeFileChange = (e) => {
        const file = e.target.files?.[0] ?? null;
        setEmployeeFile(file);
        setSummaryError("");
    };

    const handleGenerateSummary = async () => {
        if (!employeeFile) return;
        setIsGeneratingSummary(true);
        setSummaryError("");

        try {
            const [{ default: ExcelJS }, arrayBuffer, { data: quizData, error: quizError }] = await Promise.all([
                import("exceljs"),
                employeeFile.arrayBuffer(),
                supabase.from("quiz_results").select("employee_id, score, time, comment, created_at"),
            ]);

            if (quizError) throw quizError;

            const inputWorkbook = new ExcelJS.Workbook();
            await inputWorkbook.xlsx.load(arrayBuffer);

            const empSheet = findEmployeeSheet(inputWorkbook);
            if (!empSheet) {
                setSummaryError(t("report.missingSheetError"));
                return;
            }

            const colMap = buildColumnIndexMap(empSheet.getRow(1), EMPLOYEE_COLUMN_KEYS);
            if (!colMap.emId) {
                setSummaryError(t("report.missingEmIdColumnError"));
                return;
            }

            // สร้างตารางเทียบ employee_id (Supabase) -> ผลสอบ พร้อมคีย์สำรองแบบตัดเลข 0 นำหน้า
            // เผื่อไฟล์ข้อมูลพนักงานเก็บรหัสเป็นตัวเลขแล้วเลข 0 นำหน้าหายไป
            const quizMap = new Map();
            (quizData ?? []).forEach((row) => {
                const key = normalizeKey(row.employee_id);
                if (!key) return;
                quizMap.set(key, row);
                const alt = numericAltKey(key);
                if (alt && !quizMap.has(alt)) quizMap.set(alt, row);
            });

            const lookupQuizResult = (rawEmId) => {
                const key = normalizeKey(rawEmId);
                if (!key) return undefined;
                if (quizMap.has(key)) return quizMap.get(key);
                const alt = numericAltKey(key);
                return alt ? quizMap.get(alt) : undefined;
            };

            const statusDone = t("report.statusDone");
            const statusNotDone = t("report.statusNotDone");
            const statusPass = t("report.statusPass");
            const statusNotPass = t("report.statusNotPass");

            const outWorkbook = new ExcelJS.Workbook();
            const outSheet = outWorkbook.addWorksheet("สรุปผล");
            const headers = [
                "emId", "prefixNameTh", "firstnameTh", "lastnameTh", "companyName", "sectionName",
                t("report.colTestStatus"), t("report.colCriteria"),
                t("report.colScore"), t("report.colTime"), t("report.colComment"), t("report.colCreatedAt"),
            ];
            outSheet.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(16, h.length + 4) }));
            outSheet.getRow(1).font = { bold: true };
            outSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE699" } };

            let outRowNumber = 2;
            for (let r = 2; r <= empSheet.rowCount; r++) {
                const empRow = empSheet.getRow(r);
                const emIdRaw = cellText(empRow.getCell(colMap.emId)).trim();
                if (!emIdRaw) continue; // ข้ามแถวว่าง

                const get = (key) => (colMap[key] ? cellText(empRow.getCell(colMap[key])) : "");
                const hit = lookupQuizResult(emIdRaw);

                const outRow = outSheet.getRow(outRowNumber);
                outRow.getCell(1).value = emIdRaw;
                outRow.getCell(2).value = get("prefixNameTh");
                outRow.getCell(3).value = get("firstnameTh");
                outRow.getCell(4).value = get("lastnameTh");
                outRow.getCell(5).value = get("companyName");
                outRow.getCell(6).value = get("sectionName");

                if (hit) {
                    const pass = Number(hit.score) === 10;
                    outRow.getCell(7).value = statusDone;
                    outRow.getCell(8).value = pass ? statusPass : statusNotPass;
                    outRow.getCell(9).value = hit.score;
                    outRow.getCell(10).value = hit.time;
                    outRow.getCell(11).value = hit.comment;
                    outRow.getCell(12).value = formatBangkokTime(hit.created_at);
                } else {
                    outRow.getCell(7).value = statusNotDone;
                    outRow.getCell(8).value = statusNotDone;
                }
                outRowNumber++;
            }

            const lastRow = outRowNumber - 1;
            outSheet.autoFilter = { from: "A1", to: "L1" };
            outSheet.views = [{ state: "frozen", ySplit: 1 }];

            if (lastRow >= 2) {
                outSheet.addConditionalFormatting({
                    ref: `G2:G${lastRow}`,
                    rules: [
                        { type: "cellIs", operator: "equal", formulae: [`"${statusNotDone}"`], priority: 1,
                            style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFF8CBAD" } } } },
                        { type: "cellIs", operator: "equal", formulae: [`"${statusDone}"`], priority: 2,
                            style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFC6E0B4" } } } },
                    ],
                });
                outSheet.addConditionalFormatting({
                    ref: `H2:H${lastRow}`,
                    rules: [
                        { type: "cellIs", operator: "equal", formulae: [`"${statusNotPass}"`], priority: 1,
                            style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFF8CBAD" } } } },
                        { type: "cellIs", operator: "equal", formulae: [`"${statusPass}"`], priority: 2,
                            style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFC6E0B4" } } } },
                    ],
                });
            }

            const buffer = await outWorkbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = buildSummaryFilename(new Date());
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            setSummaryError(t("report.summaryGenerateError"));
        } finally {
            setIsGeneratingSummary(false);
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

                            <div className="my-6 border-t border-white/10" />

                            <div className="text-left">
                                <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                                    <Upload size={18} className="text-yellow-400" /> {t("report.uploadTitle")}
                                </h2>
                                <p className="text-white/60 text-sm mb-4">{t("report.uploadDesc")}</p>

                                <label className="flex items-center gap-2 w-full rounded-2xl border-2 border-dashed border-white/20 hover:border-yellow-400/50 px-4 py-4 cursor-pointer transition-all text-sm text-white/70 mb-3">
                                    <FileCheck2 size={18} className={employeeFile ? "text-emerald-400 flex-shrink-0" : "text-white/40 flex-shrink-0"} />
                                    <span className="truncate">{employeeFile ? employeeFile.name : t("report.noFileChosen")}</span>
                                    <input
                                        type="file"
                                        accept=".xlsx"
                                        className="hidden"
                                        onChange={handleEmployeeFileChange}
                                    />
                                </label>

                                {summaryError && (
                                    <div className="text-red-400 text-sm mb-3">⚠️ {summaryError}</div>
                                )}

                                <button
                                    onClick={handleGenerateSummary}
                                    disabled={!employeeFile || isGeneratingSummary}
                                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold py-3.5 transition-all duration-300 hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                                >
                                    <Download size={20} />
                                    {isGeneratingSummary ? t("report.generatingButton") : t("report.generateButton")}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
