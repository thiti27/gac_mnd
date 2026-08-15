import { createContext, useContext, useState, useCallback } from "react";

// ให้ Navbar รู้ว่าตอนนี้กำลังทำ Quiz ค้างอยู่ไหม (สำหรับเด้ง popup ยืนยันตอนกดเมนู Quiz ซ้ำ)
// และให้ Navbar สั่งให้หน้า Quiz รีเซ็ตได้ (ผ่าน resetToken ที่เปลี่ยนค่าทุกครั้งที่สั่ง)
const QuizProgressContext = createContext({
    inProgress: false,
    setInProgress: () => { },
    resetToken: 0,
    requestReset: () => { },
});

export function QuizProgressProvider({ children }) {
    const [inProgress, setInProgress] = useState(false);
    const [resetToken, setResetToken] = useState(0);

    const requestReset = useCallback(() => {
        setResetToken((t) => t + 1);
    }, []);

    return (
        <QuizProgressContext.Provider value={{ inProgress, setInProgress, resetToken, requestReset }}>
            {children}
        </QuizProgressContext.Provider>
    );
}

export function useQuizProgress() {
    return useContext(QuizProgressContext);
}
