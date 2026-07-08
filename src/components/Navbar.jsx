import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Trophy, ClipboardList, Menu, X } from "lucide-react";
import logo from "../../public/logo.png"; // ปรับ path ตามจริง

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);

    const navLinkClass = ({ isActive }) =>
        `flex items-center gap-2 px-4 py-2.5 rounded-xl transition text-sm font-medium w-full ${isActive
            ? "bg-purple-600 text-white"
            : "bg-white/5 hover:bg-white/10 text-white/90"
        }`;

    return (
        <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0F0A1F]/95 border-b border-white/10">
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
                            <p className="text-xs text-gray-400 -mt-0.5">กลุ่ม M&amp;D and Compliance</p>
                        </div>
                    </div>

                    {/* Menu */}
                    <div className="flex items-center gap-2">
                        <NavLink to="/" className={navLinkClass}>
                            <Trophy size={18} />
                            Leaderboard
                        </NavLink>
                        <NavLink to="/quiz" className={navLinkClass}>
                            <ClipboardList size={18} />
                            Quiz
                        </NavLink>
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
                            <p className="text-[10px] text-gray-400 -mt-0.5">กลุ่ม M&amp;D and Compliance </p>
                        </div>
                    </div>

                    {/* Right: Hamburger */}
                    <button
                        onClick={toggleMenu}
                        className="p-2 text-white/80 hover:text-white transition"
                        aria-label="Toggle menu"
                    >
                        {isOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
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
                            Leaderboard
                        </NavLink>

                        <NavLink
                            to="/quiz"
                            className={navLinkClass}
                            onClick={() => setIsOpen(false)}
                        >
                            <ClipboardList size={18} />
                            Quiz
                        </NavLink>
                    </div>
                </div>
            )}
        </nav>
    );
}