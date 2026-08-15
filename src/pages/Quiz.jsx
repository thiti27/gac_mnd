import { useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuizProgress } from "../context/QuizProgressContext";
import { useLanguage } from "../context/LanguageContext";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import Select from "react-select";
import questions from "../data/questions";
import confetti from "canvas-confetti";
import { supabase } from "../lib/supabase";

const COMMENT_MAX_LENGTH = 500;
// update แบบมีเงื่อนไขระดับ query เดียว (atomic): Postgres จะแก้แถวก็ต่อเมื่อ
// คะแนนปัจจุบัน "ในฐานข้อมูล ณ ขณะนั้น" ยังไม่ถึง 10 และผลใหม่ดีกว่าจริง ๆ
// เงื่อนไขถูกประเมิน ณ ตอน execute โดย Postgres เอง ไม่ได้อิงจากค่าที่ฝั่ง client
// อ่านมาก่อนหน้า จึงไม่มี race แม้มีหลาย request ชนกันพร้อมกัน (ต่างจากแบบ
// select-แล้วค่อย-update ที่อาจใช้ค่าเก่าตัดสินใจ)
const applyBestScoreUpdate = async (data) => {
    const { error } = await supabase
        .from("quiz_results")
        .update({
            score: data.score,
            time: data.time,
            comment: data.comment,
        })
        .eq("employee_id", data.employee_id)
        .lt("score", 10)
        .or(`score.lt.${data.score},and(score.eq.${data.score},time.gt.${data.time})`);

    if (error) {
        console.error(error);
        throw error;
    }
    return true;
};

const sendToSupabase = async (data) => {
    // 1) ลอง insert ก่อนเสมอ (กรณีปกติ = ยังไม่เคยมี record ของ employee_id นี้)
    const { error: insertError } = await supabase
        .from("quiz_results")
        .insert([data]);

    if (!insertError) return true;

    // employee_id นี้มี unique constraint กันไว้: ถ้ามี record อยู่แล้ว (ไม่ว่าจะ
    // มีมาก่อนหน้านี้ หรือมีอีก request แข่ง insert เข้ามาพร้อมกัน เช่น เปิด 2 แท็บ)
    // Postgres จะตอบกลับด้วย error code 23505 (unique violation)
    if (insertError.code !== "23505") {
        console.error(insertError);
        throw insertError;
    }

    // 2) มี record อยู่แล้ว → update แบบมีเงื่อนไข (ทับเฉพาะตอนผลใหม่ดีกว่าจริง)
    return await applyBestScoreUpdate(data);
};

// ตรวจสอบว่ารหัสพนักงานนี้เคยได้คะแนนเต็ม 10 แล้วหรือยัง
const checkAlreadyPassed = async (employeeId) => {
    const { data: rows, error } = await supabase
        .from("quiz_results")
        .select("score")
        .eq("employee_id", employeeId)
        .order("score", { ascending: false })
        .limit(1);

    if (error) {
        console.error(error);
        throw error;
    }

    return (rows?.[0]?.score ?? 0) === 10;
};


// ฟังก์ชันยิงพลุ
const fireConfetti = () => {
    const count = 200;
    const defaults = { origin: { y: 0.7 } };

    function fire(particleRatio, opts) {
        confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio)
        });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92 });
    fire(0.1, { spread: 120, startVelocity: 45 });
};

const departmentOptions = [
    { value: "Production", label: "Production" },
    { value: "QA", label: "QA" },
    { value: "Engineering", label: "Engineering" },
    { value: "Warehouse", label: "Warehouse" },
    { value: "HR", label: "HR" },
    { value: "Maintenance", label: "Maintenance" },
    { value: "Logistics", label: "Logistics" },
    { value: "Planning", label: "Planning" },
];

function shuffleArray(array) {
    const newArray = [...array];

    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }

    return newArray;
}
export default function Quiz() {
    const [searchParams] = useSearchParams();
    const { setInProgress, resetToken } = useQuizProgress();
    const { lang, t } = useLanguage();
    const [userInfo, setUserInfo] = useState(null);
    const [answers, setAnswers] = useState({});
    const [comment, setComment] = useState("");
    const [isStarted, setIsStarted] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [result, setResult] = useState(null);
    const [startTime, setStartTime] = useState(null);
    const [submitError, setSubmitError] = useState("");
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [showAlreadyPassed, setShowAlreadyPassed] = useState(false);

    // ===== State ใหม่สำหรับ Flow: Quiz → Comment → Result =====
    const [showComment, setShowComment] = useState(false);
    const [pendingResult, setPendingResult] = useState(null); // { score, timeTaken } คำนวณไว้ก่อนเข้าหน้า Comment
    const [commentError, setCommentError] = useState("");

    const questionRefs = useRef({});
    const timerRef = useRef(null);

    // คำถามที่ใช้คิดคะแนน (ไม่รวม comment) — หน้า Comment แยกออกมาต่างหากแล้ว
    const quizQuestions = useMemo(() => {
        return shuffleArray(
            questions
                .filter(q => q.type !== "comment")
                .map(q => ({
                    ...q,
                    options: shuffleArray(q.options),
                }))
        );
    }, []);
    const totalQuestions = quizQuestions.length;

    const validationSchema = Yup.object({
        employeeId: Yup.string()
            .required(t("quiz.employeeIdRequired"))
            .test(
                "not-blank",
                t("quiz.employeeIdRequired"),
                (value) => !!value && value.trim().length > 0
            )
            .matches(/^[A-Z0-9]+$/, t("quiz.employeeIdInvalidChars"))
            .min(5, t("quiz.employeeIdMinLength")),
    });

    // เติมรหัสพนักงานให้อัตโนมัติจาก: 1) เคยกรอกไปแล้วในรอบนี้ (เช่นกด "ทำแบบทดสอบใหม่")
    // หรือ 2) มาจากลิงก์ที่แนบ ?employeeId=... มา (เช่นคลิกการ์ด Not Pass ใน Leaderboard)
    // ไม่ว่าจะทางไหนก็แค่ "เติมให้" เท่านั้น ผู้ใช้ยังต้องกดเริ่มทำแบบทดสอบเอง
    // กรองเฉพาะ A-Z0-9 ด้วย เผื่อมีคนแต่ง URL ?employeeId=... ส่งอักขระแปลกมา
    const prefillEmployeeId = (searchParams.get("employeeId") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const initialUserInfo = {
        employeeId: userInfo?.employeeId ?? prefillEmployeeId,
        fullName: "",
        department: "",
    };

    // ===== Timer: เดินเฉพาะตอนทำข้อสอบเท่านั้น =====
    // หยุดทันทีเมื่อเข้าหน้า Comment (showComment) หรือส่งเสร็จ (isSubmitted)
    useEffect(() => {
        if (isStarted && !isSubmitted && !showComment) {
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isStarted, isSubmitted, showComment]);

    // ===== รายงานสถานะ "กำลังทำข้อสอบค้างอยู่ไหม" ให้ Navbar รู้ =====
    // เพื่อเด้ง popup ยืนยันตอนกดเมนู Quiz ซ้ำระหว่างทำข้อสอบ
    useEffect(() => {
        const inProgress = isStarted && !isSubmitted && !showComment;
        setInProgress(inProgress);
        return () => setInProgress(false);
    }, [isStarted, isSubmitted, showComment, setInProgress]);

    // ===== รับสัญญาณ "เริ่มใหม่" จาก Navbar (กด "ตกลง" ใน popup ยืนยัน) =====
    // resetToken เปลี่ยนค่าทุกครั้งที่ Navbar สั่งรีเซ็ต ข้าม effect แรกตอน mount
    const isFirstResetSignal = useRef(true);
    useEffect(() => {
        if (isFirstResetSignal.current) {
            isFirstResetSignal.current = false;
            return;
        }
        setIsStarted(false);
        setIsSubmitted(false);
        setAnswers({});
        setComment("");
        setResult(null);
        setSubmitError("");
        setElapsedTime(0);
        setShowComment(false);
        setPendingResult(null);
        setCommentError("");
        window.scrollTo({ top: 0, behavior: "smooth" });
        // ไม่ล้าง userInfo → ฟอร์มยังเติมรหัสพนักงานเดิมให้ ตามที่ต้องการ
    }, [resetToken]);

    const handleStartQuiz = async (values) => {
        // trim + toUpperCase กัน " abc123 " / "abc123" / "ABC123" ถูกนับเป็นคนละคน
        const employeeId = values.employeeId.trim().toUpperCase();
        setIsChecking(true);
        try {
            const alreadyPassed = await checkAlreadyPassed(employeeId);
            if (alreadyPassed) {
                setShowAlreadyPassed(true);
                return;
            }

            // รหัสพนักงานเดิม + เคยเริ่มไปแล้ว = แค่กลับมาทำต่อ (เช่นกด "กลับไปแก้ไขรหัสพนักงาน"
            // เพื่อทวนรหัสแล้วกลับมา) ไม่ใช่เริ่มรอบใหม่ → ไม่รีเซ็ตคำตอบ/เวลาที่ทำไปแล้ว
            const isResuming = userInfo !== null && employeeId === userInfo.employeeId;

            setUserInfo({ ...values, employeeId });
            setIsStarted(true);

            if (isResuming) {
                // เลื่อน startTime ชดเชยช่วงที่หยุดพักไป กันไม่ให้เวลาที่หยุดไปดูรหัส
                // ถูกนับรวมเป็นเวลาที่ใช้ทำข้อสอบ (elapsedTime ที่แสดงอยู่ยังถูกต้องอยู่แล้ว)
                setStartTime(Date.now() - elapsedTime * 1000);
            } else {
                setStartTime(Date.now());
                setElapsedTime(0);
            }

            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error) {
            console.error("ตรวจสอบสถานะรหัสพนักงานล้มเหลว:", error);
            alert(t("quiz.checkFailedAlert"));
        } finally {
            setIsChecking(false);
        }
    };

    const handleAnswer = (questionId, optionId) => {
        setAnswers(prev => ({ ...prev, [questionId]: optionId }));
        setSubmitError("");
    };

    // กด "กลับไปแก้ไขรหัสพนักงาน" ระหว่างทำข้อสอบ → แค่พักไปทวน/แก้รหัสชั่วคราว
    // ไม่ล้างคำตอบหรือเวลาที่ทำไปแล้ว (ตัวจับเวลาจะหยุดเดินเองเพราะ isStarted เป็น false
    // แล้วกลับมาเดินต่อให้ถูกต้องตอนกด "ถัดไป" อีกครั้ง — ดู isResuming ใน handleStartQuiz)
    const handleBackToEmployeeId = () => {
        setIsStarted(false);
        setSubmitError("");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // กด "คลิกเพื่อทำแบบทดสอบอีกครั้ง" จากหน้าผลคะแนน → ข้ามหน้ากรอกฟอร์ม
    // ใช้รหัสพนักงานเดิมที่มีอยู่แล้วเช็คแล้วเข้าหน้า Quiz ทันที
    const handleRetryQuiz = async () => {
        const employeeId = userInfo?.employeeId;
        if (!employeeId) {
            resetQuiz();
            return;
        }

        setIsChecking(true);
        try {
            const alreadyPassed = await checkAlreadyPassed(employeeId);

            // reset ค่าที่เกี่ยวกับรอบทำแบบทดสอบก่อนหน้าทุกครั้ง ไม่ว่าจะผ่านหรือไม่
            setAnswers({});
            setComment("");
            setSubmitError("");
            setShowComment(false);
            setPendingResult(null);
            setCommentError("");
            setResult(null);
            setIsSubmitted(false);

            if (alreadyPassed) {
                setIsStarted(false);
                setShowAlreadyPassed(true);
                return;
            }

            setIsStarted(true);
            setStartTime(Date.now());
            setElapsedTime(0);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error) {
            console.error("ตรวจสอบสถานะรหัสพนักงานล้มเหลว:", error);
            alert(t("quiz.checkFailedAlert"));
        } finally {
            setIsChecking(false);
        }
    };

    // ===== Progress: นับเฉพาะข้อสอบ 10 ข้อ (Comment ไม่นับ) =====
    const answeredCount = Object.keys(answers).length;
    const progress = Math.round((answeredCount / totalQuestions) * 100);

    const validateAnswers = () => {
        const unanswered = quizQuestions
            .filter(q => !answers[q.id])
            .map(q => q.id);

        if (unanswered.length > 0) {
            const firstUnansweredId = unanswered[0];
            setSubmitError(t("quiz.answerAllRequired"));
            const ref = questionRefs.current[firstUnansweredId];
            if (ref) ref.scrollIntoView({ behavior: "smooth", block: "center" });
            return false;
        }
        return true;
    };

    // ===== ขั้นที่ 1: กด "ส่งคำตอบ" → หยุดเวลา + คำนวณคะแนน (ยังไม่ Save) → ไปหน้า Comment =====
    // บันทึกผลลง Supabase + แสดงหน้าผลลัพธ์ ใช้ร่วมกันทั้งกรณีผ่าน (มี comment)
    // และไม่ผ่าน (ข้ามหน้า comment ไปเลย ไม่มี comment)
    const saveResultAndFinish = async (score, timeTaken, commentText) => {
        setIsLoading(true);

        const attemptData = {
            employee_id: userInfo.employeeId,
            score,
            time: timeTaken,
            comment: commentText,
        };

        try {
            await sendToSupabase(attemptData);

            // ล้าง cache ของหน้า Leaderboard (key ต้องตรงกับ LEADERBOARD_CACHE_KEY ใน src/pages/Home.jsx)
            // กันไม่ให้กด "ดู Leaderboard" ต่อจากหน้านี้แล้วเจอข้อมูลเก่าที่ยังไม่รวมผลที่เพิ่งส่ง
            try {
                sessionStorage.removeItem("leaderboard_cache_v1");
            } catch {
                // sessionStorage ใช้งานไม่ได้ (เช่น private mode บางเบราว์เซอร์) → ข้ามเงียบ ๆ ไม่กระทบการบันทึกผล
            }

            setResult({ score, time: timeTaken });
            setShowComment(false);
            setIsSubmitted(true);
            window.scrollTo({ top: 0, behavior: "smooth" });

            // ยิงพลุเมื่อได้ 10 คะแนน
            if (score === 10) {
                setTimeout(() => {
                    fireConfetti();
                }, 400);
            }
        } catch (error) {
            console.error("ส่งข้อมูลไป Google Sheet ล้มเหลว:", error);
            alert(t("quiz.saveFailedAlert"));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitQuiz = () => {
        if (!validateAnswers()) return;

        // เวลาที่ใช้ = เวลาของข้อ 1-10 เท่านั้น (จับ ณ วินาทีที่กดส่งคำตอบ)
        const endTime = Date.now();
        const timeTaken = Math.floor((endTime - startTime) / 1000);

        let score = 0;
        quizQuestions.forEach(q => {
            const selected = answers[q.id];
            const correctOption = q.options.find(opt => opt.correct);
            if (selected === correctOption?.id) score++;
        });

        const finalScore = Math.round((score / totalQuestions) * 10);

        if (finalScore === 10) {
            // ผ่าน 10/10 → ให้กรอกความคิดเห็นก่อน ยังไม่บันทึก ยังไม่แสดงผล
            setPendingResult({ score: finalScore, timeTaken });
            setShowComment(true); // Timer จะหยุดอัตโนมัติจาก useEffect
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            // ยังไม่ผ่าน → ข้ามหน้า comment ไปเลย บันทึกผล+แจ้งผลทันที
            saveResultAndFinish(finalScore, timeTaken, "");
        }
    };

    // ===== กด "ส่งคำตอบ และดูผลคะแนน" ในหน้า Comment (เฉพาะคนที่ได้ 10/10) =====
    const handleSubmitComment = async () => {
        if (!comment.trim()) {
            setCommentError(t("quiz.commentRequired"));
            return;
        }
        setCommentError("");
        await saveResultAndFinish(pendingResult.score, pendingResult.timeTaken, comment.trim());
    };

    const resetQuiz = () => {
        setAnswers({});
        setComment("");
        setIsStarted(false);
        setIsSubmitted(false);
        setResult(null);
        setStartTime(null);
        setSubmitError("");
        setElapsedTime(0);
        // reset state ใหม่ทั้งหมด
        setShowComment(false);
        setPendingResult(null);
        setCommentError("");
    };

    const customSelectStyles = {
        control: (base, state) => ({
            ...base,
            backgroundColor: "#1F1F2E",
            borderColor: state.isFocused ? "#FACC15" : "#374151",
            borderRadius: "16px",
            minHeight: "48px",
            boxShadow: "none",
            "&:hover": { borderColor: "#FACC15" },
        }),
        menu: (base) => ({ ...base, backgroundColor: "#1F1F2E", borderRadius: "12px" }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? "#FACC15" : state.isFocused ? "#374151" : "#1F1F2E",
            color: state.isSelected ? "#000000" : "#FFFFFF",
        }),
        singleValue: (base) => ({ ...base, color: "#FFFFFF" }),
    };

    return (
        <div className="min-h-screen text-white p-4 md:p-8"
            style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, #2d1b69 0%, #0F0A1F 60%)" }}>

            {/* ===== CSS Animations ===== */}
            <style>{`
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(24px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes popIn {
                    0% { opacity: 0; transform: scale(0.6); }
                    70% { transform: scale(1.08); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes glowPulse {
                    0%, 100% { box-shadow: 0 0 20px rgba(250,204,21,0.25); }
                    50% { box-shadow: 0 0 45px rgba(250,204,21,0.55); }
                }
                @keyframes bounceSoft {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                @keyframes shakeX {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-6px); }
                    40%, 80% { transform: translateX(6px); }
                }
                @keyframes shimmerText {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                .anim-fade-up { animation: fadeSlideUp 0.5s ease both; }
                .anim-pop { animation: popIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
                .anim-glow { animation: glowPulse 2.5s ease-in-out infinite; }
                .anim-bounce { animation: bounceSoft 2s ease-in-out infinite; }
                .anim-shake { animation: shakeX 0.45s ease; }
                .anim-shimmer {
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

            <div className="max-w-3xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-black text-center mb-2 anim-shimmer">{t("quiz.title")}</h1>
                <p className="text-center text-white/60 mb-8">{t("quiz.subtitle")}</p>

                {/* กติกา — แสดงเฉพาะก่อนเริ่ม เป็น banner บางๆ ไม่ใช่การ์ดแบบเดียวกับฟอร์มด้านล่าง */}
                {!isStarted && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-center text-center gap-1.5 sm:gap-3 mb-4 px-4 py-3 rounded-2xl bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-emerald-500/10 border border-yellow-400/20 text-sm anim-fade-up">
                        <span className="font-bold text-emerald-300 flex-shrink-0">{t("quiz.ruleMustPass")}</span>
                        <span className="hidden sm:inline text-white/20">|</span>
                        <span className="text-white/70">{t("quiz.ruleRanking")}</span>
                    </div>
                )}

                {/* ฟอร์มข้อมูลพนักงาน — เน้นช่องกรอกรหัสเป็นจุดเด่นเดียวของการ์ด ไม่มีองค์ประกอบรอง */}
                {!isStarted && (
                    <div
                        className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-sm anim-fade-up"
                        style={{ animationDelay: "0.1s" }}
                    >
                        <h2 className="text-center text-white/70 text-sm font-medium mb-4">
                            {t("quiz.formHeading")}
                        </h2>

                        <Formik
                            initialValues={initialUserInfo}
                            validationSchema={validationSchema}
                            onSubmit={handleStartQuiz}
                        >
                            {({ errors, touched }) => (
                                <Form>
                                    <Field name="employeeId">
                                        {({ field, form }) => (
                                            <input
                                                {...field}
                                                type="text"
                                                placeholder={t("quiz.employeeIdPlaceholder")}
                                                autoFocus
                                                onChange={(e) => {
                                                    // พิมพ์ตัวเล็กแปลงเป็นตัวใหญ่ + ตัดช่องว่าง/อักขระที่ไม่ใช่ A-Z0-9 ออกอัตโนมัติ
                                                    // ระหว่างพิมพ์ ป้องกันปัญหาตัวพิมพ์/whitespace/อักขระแปลกตั้งแต่ต้นทาง
                                                    const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                                                    form.setFieldValue("employeeId", cleaned);
                                                }}
                                                className={`w-full rounded-2xl bg-white/10 border-2 px-4 py-5 text-center text-2xl md:text-3xl font-black tracking-widest text-yellow-300 placeholder:text-white/20 placeholder:font-normal placeholder:tracking-normal placeholder:text-base transition-all focus:outline-none focus:ring-4 focus:ring-yellow-400/20 focus:border-yellow-400 ${errors.employeeId && touched.employeeId
                                                    ? "border-red-500"
                                                    : "border-white/20"
                                                    }`}
                                            />
                                        )}
                                    </Field>

                                    <ErrorMessage
                                        name="employeeId"
                                        component="div"
                                        className="text-red-400 text-sm mt-2 text-center"
                                    />

                                    <button
                                        type="submit"
                                        disabled={isChecking}
                                        className="mt-6 w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold py-3.5 transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-yellow-500/20 disabled:opacity-60 disabled:hover:scale-100"
                                    >
                                        {isChecking ? t("quiz.checking") : t("quiz.startQuiz")}
                                    </button>
                                </Form>
                            )}
                        </Formik>
                    </div>
                )}
                {/* ===== แบบทดสอบ (ข้อ 1-10) ===== */}
                {isStarted && !isSubmitted && !showComment && (
                    <div className="space-y-8">
                        {/* Status Bar — ไม่ float/sticky แล้ว เลื่อนไปกับหน้าปกติ อยากเช็คเวลาก็เลื่อนขึ้นไปดู */}
                        <div className="bg-[#1F1F2E] border border-white/20 rounded-2xl px-4 py-2.5 shadow-lg">
                            <div className="flex items-center gap-3 text-sm">
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className="text-yellow-400">⏱</span>
                                    <span className="font-mono font-bold">
                                        {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                                    </span>
                                </div>

                                <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                                    <div className="h-1.5 bg-gradient-to-r from-yellow-400 to-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }} />
                                </div>

                                <div className={`flex-shrink-0 font-medium flex items-center gap-1 ${progress === 100 ? "text-emerald-400" : ""}`}>
                                    {answeredCount}/{totalQuestions}
                                    {progress === 100 && <span>🎉</span>}
                                </div>
                            </div>
                        </div>

                        {/* คำถาม (เฉพาะข้อสอบ ไม่รวม Comment) */}
                        {quizQuestions.map((q, index) => (
                            <div key={q.id} ref={el => questionRefs.current[q.id] = el}
                                className={`scroll-mt-4 bg-white/5 border rounded-3xl overflow-hidden transition-all duration-300 anim-fade-up select-none
                                    ${answers[q.id] ? "border-emerald-400/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]" : "border-white/10"}`}
                                style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}
                                onCopy={(e) => e.preventDefault()}
                                onContextMenu={(e) => e.preventDefault()}>

                                {/* โซนคำถาม — แยกพื้นหลังเข้มกว่าตัวเลือกด้านล่างชัดเจน */}
                                <div className="flex gap-3 items-start bg-black/20 px-4 py-4 md:px-6 md:py-5 border-b border-white/10">
                                    <div className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm transition-all
                                        ${answers[q.id] ? "bg-emerald-400 text-black scale-110" : "bg-yellow-400 text-black"}`}>
                                        {answers[q.id] ? "✓" : index + 1}
                                    </div>
                                    <h3 className="font-bold text-lg md:text-xl leading-relaxed pt-1">{q.question[lang]}</h3>
                                </div>

                                {/* โซนตัวเลือกคำตอบ */}
                                <div className="p-4 md:p-6 space-y-3">
                                    {q.options.map((option, index) => (
                                        <label
                                            key={option.id}
                                            className={`flex items-center gap-3 p-3 md:gap-4 md:p-4 rounded-2xl cursor-pointer border transition-all duration-200
        ${answers[q.id] === option.id
                                                    ? "bg-yellow-400/15 border-yellow-400 scale-[1.01] shadow-[0_0_15px_rgba(250,204,21,0.15)]"
                                                    : "bg-white/[0.08] border-white/15 hover:bg-white/[0.14] hover:border-white/30 hover:translate-x-1"
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                checked={answers[q.id] === option.id}
                                                onChange={() => handleAnswer(q.id, option.id)}
                                                className="accent-yellow-400 flex-shrink-0"
                                            />

                                            <div className="flex items-center gap-3">
                                                <span className={`flex items-center justify-center w-8 h-8 flex-shrink-0 rounded-full font-bold transition-all
                                                    ${answers[q.id] === option.id ? "bg-yellow-400 text-black" : "bg-white/10 text-yellow-300"}`}>
                                                    {t("quiz.choiceLabels")[index]}
                                                </span>

                                                <span className="text-base leading-relaxed tracking-normal">{option.text[lang]}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {submitError && (
                            <div className="anim-shake text-center text-red-400 font-medium bg-red-500/10 border border-red-500/30 rounded-2xl py-3">
                                ⚠️ {submitError}
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <button onClick={handleSubmitQuiz}
                                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-4 rounded-2xl text-lg transition-all hover:scale-[1.02] shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                                {t("quiz.next")}
                            </button>

                            <button
                                onClick={handleBackToEmployeeId}
                                className="w-full px-5 py-4 rounded-2xl font-medium border border-white/30 hover:bg-white/10 transition-all hover:scale-[1.02]"
                            >
                                {t("quiz.backToEmployeeId")}
                            </button>
                        </div>
                    </div>
                )}

                {/* ===== หน้า Comment (Timer หยุดแล้ว / คะแนนคำนวณแล้วแต่ยังไม่แสดง) ===== */}
                {isStarted && !isSubmitted && showComment && (
                    <div className="anim-pop">
                        <div className="bg-white/5 border border-yellow-400/40 rounded-3xl p-6 md:p-10 anim-glow">
                            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                                <span className="inline-block text-xs font-semibold text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 rounded-full px-2.5 py-0.5">
                                    {t("quiz.notTimed")}
                                </span>
                                <span className="inline-block text-xs font-semibold text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 rounded-full px-2.5 py-0.5">
                                    {t("quiz.anonymousNote")}
                                </span>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6 mb-6">
                                <h3 className="font-semibold text-base md:text-lg mb-4 flex gap-2 leading-relaxed select-none"
                                    onCopy={(e) => e.preventDefault()}
                                    onContextMenu={(e) => e.preventDefault()}>
                                    <span className="text-yellow-400 flex-shrink-0">Q:</span>
                                    <span>{t("quiz.commentQuestion")}</span>
                                </h3>
                                <textarea
                                    value={comment}
                                    onChange={(e) => { setComment(e.target.value.slice(0, COMMENT_MAX_LENGTH)); setCommentError(""); }}
                                    placeholder={t("quiz.commentPlaceholder")}
                                    maxLength={COMMENT_MAX_LENGTH}
                                    className={`w-full h-36 bg-white/10 border rounded-2xl p-4 resize-y leading-relaxed focus:outline-none focus:border-yellow-400 focus:shadow-[0_0_20px_rgba(250,204,21,0.2)] transition-all
                                        ${commentError ? "border-red-500" : "border-white/20"}`}
                                />
                                <div className="text-right text-xs text-white/40 mt-1">
                                    {comment.length}/{COMMENT_MAX_LENGTH}
                                </div>
                                {commentError && (
                                    <div className="anim-shake text-red-400 text-sm mt-3 flex items-center gap-1">
                                        ⚠️ {commentError}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3">
                                <button onClick={handleSubmitComment} disabled={isLoading}
                                    className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white font-bold py-4 rounded-2xl text-lg transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                                    {t("quiz.submitComment")}
                                </button>

                                <button
                                    onClick={() => setShowComment(false)}
                                    disabled={isLoading}
                                    className="w-full px-5 py-4 rounded-2xl font-medium border border-white/30 hover:bg-white/10 transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                                >
                                    {t("quiz.backToEditAnswers")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== ผลลัพธ์ ===== */}
                {isSubmitted && result && (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-5 md:p-8 text-center anim-pop">
                        <h2 className="text-3xl font-bold mb-6">{t("quiz.thankYou")}</h2>

                        {/* แสดงสถานะ */}
                        <div className="mb-6 anim-pop" style={{ animationDelay: "0.2s" }}>
                            {result.score === 10 ? (
                                <div className="inline-flex items-center gap-3 bg-emerald-500/10 text-emerald-400 px-8 py-3 rounded-2xl text-2xl font-bold border border-emerald-400/30 shadow-[0_0_30px_rgba(16,185,129,0.25)]">
                                    {t("quiz.passed")}
                                </div>
                            ) : (
                                <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 px-6 py-2 rounded-2xl text-lg font-bold border border-red-400/30">
                                    {t("quiz.notPassed")}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-center gap-8 mb-8">
                            <div className="anim-pop" style={{ animationDelay: "0.35s" }}>
                                <div className={`text-6xl font-black ${result.score === 10 ? "text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]" : "text-yellow-400"}`}>{result.score}</div>
                                <div className="text-white/60">{t("quiz.scoreLabel")}</div>
                            </div>
                            <div className="anim-pop" style={{ animationDelay: "0.5s" }}>
                                <div className="text-6xl font-black text-white">{result.time}</div>
                                <div className="text-white/60">{t("quiz.secondsLabel")}</div>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 justify-center">
                            {result.score < 10 && (
                                <button
                                    onClick={handleRetryQuiz}
                                    disabled={isChecking}
                                    className="px-10 py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-400 hover:to-blue-400 text-white transition-all hover:scale-105 shadow-[0_0_25px_rgba(59,130,246,0.35)] disabled:opacity-60 disabled:hover:scale-100"
                                >
                                    {isChecking ? t("quiz.checking") : t("quiz.retryAgain")}
                                </button>
                            )}
                            {result.score === 10 && (
                                <a href="/" className="px-8 py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold rounded-2xl hover:from-yellow-300 hover:to-amber-400 transition-all hover:scale-105 text-center">
                                    {t("quiz.viewLeaderboard")}
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Popup: เคยทำแบบทดสอบผ่านแล้ว */}
            {showAlreadyPassed && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
                    <div className="bg-[#1F1F2E] border border-yellow-400/40 rounded-3xl px-8 py-8 text-center w-full max-w-[320px] anim-pop anim-glow">
                        <div className="text-6xl mb-4 anim-bounce inline-block">🏆</div>
                        <p className="text-xl font-bold mb-2">{t("quiz.alreadyPassedTitle")}</p>
                        <p className="text-white/70 mb-6">{t("quiz.alreadyPassedBody")}</p>
                        <button
                            onClick={() => setShowAlreadyPassed(false)}
                            className="w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold py-3 transition-all hover:scale-[1.02]"
                        >
                            {t("quiz.ok")}
                        </button>
                    </div>
                </div>
            )}

            {/* Loading Popup */}
            {isLoading && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
                    <div className="bg-[#1F1F2E] border border-white/20 rounded-3xl px-8 py-8 text-center w-full max-w-[280px] anim-pop">
                        <div className="flex justify-center mb-4">
                            <div className="relative w-12 h-12">
                                <div className="absolute inset-0 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">🎁</div>
                            </div>
                        </div>
                        <p className="text-lg font-medium">{t("quiz.submittingTitle")}</p>
                        <p className="text-sm text-white/60 mt-1">{t("quiz.pleaseWait")}</p>
                    </div>
                </div>
            )}
        </div>
    );
}