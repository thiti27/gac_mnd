import { createContext, useContext, useState, useEffect } from "react";
import { translations } from "../data/translations";

const LANG_STORAGE_KEY = "site_lang";

const LanguageContext = createContext({
    lang: "th",
    setLang: () => { },
    t: (key) => key,
});

const readStoredLang = () => {
    try {
        const stored = localStorage.getItem(LANG_STORAGE_KEY);
        return stored === "en" ? "en" : "th";
    } catch {
        return "th";
    }
};

export function LanguageProvider({ children }) {
    // ภาษาเริ่มต้นของเว็บคือไทยเสมอ (default th) ตามที่กำหนดไว้
    const [lang, setLangState] = useState(readStoredLang);

    useEffect(() => {
        try {
            localStorage.setItem(LANG_STORAGE_KEY, lang);
        } catch {
            // localStorage ใช้งานไม่ได้ (เช่น private mode) → ข้ามเงียบ ๆ ไม่กระทบการทำงานหลัก
        }
    }, [lang]);

    const setLang = (next) => setLangState(next === "en" ? "en" : "th");

    // ดึงข้อความจาก dictionary ตาม key แบบ "namespace.key" เช่น t("nav.quiz")
    const t = (key) => {
        const parts = key.split(".");
        let node = translations[lang];
        for (const part of parts) {
            node = node?.[part];
        }
        if (node === undefined) {
            // key หาไม่เจอ → กันแอปพัง ใช้ภาษาไทย (ต้นทาง) เป็น fallback แล้ว log เตือนไว้
            let fallback = translations.th;
            for (const part of parts) {
                fallback = fallback?.[part];
            }
            if (fallback === undefined) {
                console.warn(`[i18n] missing translation key: ${key}`);
                return key;
            }
            return fallback;
        }
        return node;
    };

    return (
        <LanguageContext.Provider value={{ lang, setLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    return useContext(LanguageContext);
}
