import { useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import { Trophy, ClipboardList, Menu, X, Languages } from "lucide-react";
import { useQuizProgress } from "../context/QuizProgressContext";
import { useLanguage } from "../context/LanguageContext";
import logo from "../../public/logo.png"; // ปรับ path ตามจริง

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [showRestartConfirm, setShowRestartConfirm] = useState(false);
    const location = useLocation();
    const { inProgress, requestReset } = useQuizProgress();
    const { lang, setLang, t } = useLanguage();

    const toggleMenu = () => setIsOpen(!isOpen);
    const toggleLang = () => setLang(lang === "th" ? "en" : "th");

    const navLinkClass = ({ isActive }) =>
        `flex items-center gap-2 px-4 py-2.5 rounded-xl transition text-sm font-medium w-full ${isActive
            ? "bg-purple-600 text-white"
            : "bg-white/5 hover:bg-white/10 text-white/90"
        }`;

    // กดเมนู Quiz ระหว่างที่กำลังทำข้อสอบค้างอยู่ (อยู่หน้า /quiz พอดี) → กันไว้ก่อน
    // เด้ง popup ถามยืนยัน แทนที่จะปล่อยให้กดเฉยๆ โดยไม่รู้ตัวว่าจะเสียคำตอบที่ทำไว้
    const handleQuizNavClick = (e) => {
        setIsOpen(false);
        if (inProgress && location.pathname === "/quiz") {
            e.preventDefault();
            setShowRestartConfirm(true);
        }
    };

    const handleConfirmRestart = () => {
        requestReset();
        setShowRestartConfirm(false);
    };

    // ปุ่มสลับภาษา TH/EN — ค่าที่โชว์คือภาษาที่จะ "สลับไปเป็น" (กด EN ตอนอยู่ TH เพื่อเปลี่ยนเป็นอังกฤษ)
    const LangToggleButton = ({ className = "" }) => (
        <button
            onClick={toggleLang}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold bg-white/5 hover:bg-white/10 border border-white/15 text-white/90 transition ${className}`}
            aria-label="Toggle language"
        >
            <Languages size={16} />
            {t("common.langToggle")}
        </button>
    );

    return (
        <>
        <nav className="backdrop-blur-xl bg-[#0F0A1F]/95 border-b border-white/10">
            <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">

                {/* ==================== DESKTOP ==================== */}
                <div className="hidden md:flex items-center justify-between w-full">
                    {/* Left: Logo + Title */}
                    <div className="flex items-center gap-3">
                        <img
                            src={logo}
                            alt="GAC M&D Logo"
                            className="w-40 h-40 object-contain"   // ← เปลี่ยนเป็น object-contain
                        />
                        <div>
                            <h1 className="font-bold text-lg">GAC Season 4</h1>
                            <p className="text-xs text-gray-400 -mt-0.5">{t("nav.orgSubtitle")}</p>
                        </div>
                    </div>

                    {/* Menu */}
                    <div className="flex items-center gap-2">
                        <NavLink to="/" className={navLinkClass}>
                            <Trophy size={18} />
                            {t("nav.leaderboard")}
                        </NavLink>
                        <NavLink to="/quiz" className={navLinkClass} onClick={handleQuizNavClick}>
                            <ClipboardList size={18} />
                            {t("nav.quiz")}
                        </NavLink>
                        {/* <NavLink to="/report" className={navLinkClass}>
                            <FileSpreadsheet size={18} />
                            Report
                        </NavLink> */}
                        <LangToggleButton className="ml-2" />
                    </div>
                </div>

                {/* ==================== MOBILE ==================== */}
                <div className="flex md:hidden items-center justify-between w-full">

                    {/* Left: Logo + Title */}
                    <div className="flex items-center gap-2.5">
                        <img
                            src={logo}
                            alt="GAC M&D Logo"
                            className="w-9 h-9 object-contain"   // ← เปลี่ยนเป็น object-contain
                        />
                        <div>
                            <h1 className="font-bold text-base leading-none">GAC Season 4</h1>
                            <p className="text-[10px] text-gray-400 -mt-0.5">{t("nav.orgSubtitle")}</p>
                        </div>
                    </div>

                    {/* Right: Lang toggle + Hamburger */}
                    <div className="flex items-center gap-2">
                        <LangToggleButton />
                        <button
                            onClick={toggleMenu}
                            className="p-2 text-white/80 hover:text-white transition"
                            aria-label="Toggle menu"
                        >
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* ==================== MOBILE MENU ==================== */}
            {isOpen && (
                <div className="md:hidden border-t border-white/10 bg-[#0F0A1F]">
                    <div className="px-4 py-3 flex flex-col gap-1.5">
                        <NavLink
                            to="/"
                            className={navLinkClass}
                            onClick={() => setIsOpen(false)}
                        >
                            <Trophy size={18} />
                            {t("nav.leaderboard")}
                        </NavLink>

                        <NavLink
                            to="/quiz"
                            className={navLinkClass}
                            onClick={handleQuizNavClick}
                        >
                            <ClipboardList size={18} />
                            {t("nav.quiz")}
                        </NavLink>

                        {/* ซ่อน Report จากเมนู (ยังเข้าตรง /report ได้ผ่าน URL ตามปกติ มีรหัสผ่านกันชั้นหนึ่งอยู่แล้วในหน้า Report เอง) */}
                        {/* <NavLink
                            to="/report"
                            className={navLinkClass}
                            onClick={() => setIsOpen(false)}
                        >
                            <FileSpreadsheet size={18} />
                            {t("nav.report")}
                        </NavLink> */}
                    </div>
                </div>
            )}

        </nav>

        {/* Popup: ยืนยันเริ่มทำแบบทดสอบใหม่ระหว่างทำค้างอยู่ */}
        {/* render ผ่าน portal เข้า document.body โดยตรง กัน backdrop-blur-xl ของ <nav>
            สร้าง containing block ใหม่ทำให้ "fixed" ยึดตำแหน่งกับ nav แทนที่จะเป็นทั้งจอ
            (เป็นสาเหตุที่ทำให้ popup โผล่ค้างอยู่แถวบนแทนที่จะอยู่กึ่งกลางจอ) */}
        {showRestartConfirm && createPortal(
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
                <div className="bg-[#1F1F2E] border border-yellow-400/40 rounded-3xl px-8 py-8 text-center w-full max-w-[340px] text-white">
                    <p className="text-lg font-bold mb-2">{t("nav.restartConfirmTitle")}</p>
                    <p className="text-white/60 text-sm mb-6">{t("nav.restartConfirmBody")}</p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleConfirmRestart}
                            className="w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold py-3 transition-all hover:scale-[1.02]"
                        >
                            {t("nav.restartConfirmOk")}
                        </button>
                        <button
                            onClick={() => setShowRestartConfirm(false)}
                            className="w-full rounded-2xl border border-white/30 hover:bg-white/10 text-white font-medium py-3 transition-all"
                        >
                            {t("nav.restartConfirmContinue")}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}
        </>
    );
}
