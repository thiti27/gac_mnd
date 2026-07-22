import { useState, useRef, useEffect, useMemo } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import Select from "react-select";
import questions from "../data/questions";
import confetti from "canvas-confetti";
import { supabase } from "../lib/supabase";
const isBetter = (newData, oldData) => {
    if (newData.score > oldData.score) return true;
    if (newData.score === oldData.score && newData.time < oldData.time) return true;
    return false;
};

const sendToSupabase = async (data) => {
    // 1) หาผลเดิมที่ดีที่สุดของ employee_id นี้ (รองรับกรณีมีหลายแถว)
    const { data: rows, error: fetchError } = await supabase
        .from("quiz_results")
        .select("id, score, time")
        .eq("employee_id", data.employee_id)
        .order("score", { ascending: false })
        .order("time", { ascending: true })
        .limit(1);

    if (fetchError) {
        console.error(fetchError);
        throw fetchError;
    }

    const existing = rows?.[0] ?? null;

    // 2) ไม่เคย save → insert ใหม่
    if (!existing) {
        const { error } = await supabase
            .from("quiz_results")
            .insert([data]);

        if (error) {
            console.error(error);
            throw error;
        }
        return true;
    }

    // 3) เคย save → ถ้าผลใหม่ดีกว่า ให้ update ทับ id เดิม
    if (isBetter(data, existing)) {
        const { error } = await supabase
            .from("quiz_results")
            .update({
                score: data.score,
                time: data.time,
                comment: data.comment,
            })
            .eq("id", existing.id);

        if (error) {
            console.error(error);
            throw error;
        }
        return true;
    }

    // 4) ผลเดิมดีกว่า → ไม่แก้ไขอะไร
    return true;
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
const choiceLabels = ["ก", "ข", "ค", "ง"];
export default function Quiz() {
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
        employeeId: Yup.string().required("กรุณากรอกรหัสพนักงาน"),
    });

    // โหลดข้อมูลผู้ใช้จาก localStorage (อายุ 1 ชั่วโมง)
    const [initialUserInfo, setInitialUserInfo] = useState({
        employeeId: "",
        fullName: "",
        department: "",
    });

    useEffect(() => {
        const savedUser = localStorage.getItem("userInfo");
        if (savedUser) {
            const parsed = JSON.parse(savedUser);
            const now = Date.now();

            if (now - parsed.timestamp > 3600000) {
                localStorage.removeItem("userInfo");
            } else {
                setInitialUserInfo({
                    employeeId: parsed.employeeId || "",
                    fullName: parsed.fullName || "",
                    department: parsed.department || "",
                });
            }
        }
    }, []);

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

    const handleStartQuiz = (values) => {
        const userData = { ...values, timestamp: Date.now() };
        localStorage.setItem("userInfo", JSON.stringify(userData));

        setUserInfo(values);
        setIsStarted(true);
        setStartTime(Date.now());
        setElapsedTime(0);
    };

    const handleAnswer = (questionId, optionId) => {
        setAnswers(prev => ({ ...prev, [questionId]: optionId }));
        setSubmitError("");
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
            setSubmitError("กรุณาตอบคำถามให้ครบทุกข้อ");
            const ref = questionRefs.current[firstUnansweredId];
            if (ref) ref.scrollIntoView({ behavior: "smooth", block: "center" });
            return false;
        }
        return true;
    };

    // ===== ขั้นที่ 1: กด "ส่งคำตอบ" → หยุดเวลา + คำนวณคะแนน (ยังไม่ Save) → ไปหน้า Comment =====
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

        // เก็บผลไว้ก่อน ยังไม่แสดง ยังไม่ Save
        setPendingResult({ score: finalScore, timeTaken });
        setShowComment(true); // Timer จะหยุดอัตโนมัติจาก useEffect
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ===== ขั้นที่ 2: กด "ส่งความคิดเห็นและดูผลคะแนน" → Save Google Sheet ครั้งเดียว → แสดงผล =====
    const handleSubmitComment = async () => {
        if (!comment.trim()) {
            setCommentError("กรุณาแสดงความคิดเห็น");
            return;
        }
        setCommentError("");
        setIsLoading(true);

        const attemptData = {
            employee_id: userInfo.employeeId,
            score: pendingResult.score,
            time: pendingResult.timeTaken,
            comment: comment.trim(),
        };

        try {
            const resultFromSheet = await sendToSupabase(attemptData);

            // บันทึก localStorage หลัง Save Google Sheet สำเร็จเท่านั้น
            const existingAttempts = JSON.parse(localStorage.getItem("attempts")) || [];
            localStorage.setItem("attempts", JSON.stringify([...existingAttempts, attemptData]));

            setResult({
                score: pendingResult.score,
                time: pendingResult.timeTaken,
            });

            setShowComment(false);
            setIsSubmitted(true);
            window.scrollTo({ top: 0, behavior: "smooth" });

            // ยิงพลุเมื่อได้ 10 คะแนน
            if (pendingResult.score === 10) {
                setTimeout(() => {
                    fireConfetti();
                }, 400);
            }
        } catch (error) {
            console.error("ส่งข้อมูลไป Google Sheet ล้มเหลว:", error);
            alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง");
        } finally {
            setIsLoading(false);
        }
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
        <div className="min-h-screen text-white p-6 md:p-8"
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
                <h1 className="text-4xl md:text-5xl font-black text-center mb-2 anim-shimmer">Quiz</h1>
                <p className="text-center text-white/60 mb-8">แบบทดสอบ M&D and Compliance</p>

                {/* กติกา — แสดงเฉพาะก่อนเริ่ม */}
                {/* กติกา */}
                {!isStarted && (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 mb-6 backdrop-blur-sm anim-fade-up">
                        <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
                            📋 กติกาการทำแบบทดสอบ
                        </h2>

                        <div className="space-y-3 text-white/80">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">📝</span>
                                <span>
                                    แบบทดสอบ <span className="font-bold text-yellow-400">10 ข้อ</span> (ข้อละ <span className="font-bold text-yellow-400">1 คะแนน</span>)
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-lg">✅</span>
                                <span>
                                    ต้องตอบถูก <span className="font-bold text-emerald-400">ครบ 10 ข้อ (10/10)</span> จึงจะผ่าน
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-lg">🔄</span>
                                <span>
                                    ทำแบบทดสอบใหม่ได้ <span className="font-bold text-sky-400">ไม่จำกัดจำนวนครั้ง</span>

                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-lg">⏱️</span>
                                <span>จับเวลาเฉพาะการทำข้อสอบ <span className="font-semibold text-white">ไม่นับเวลาแสดงความคิดเห็น</span></span>
                            </div>
                        </div>

                        <div className="mt-6 pt-5 border-t border-white/10">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-semibold text-white">🏆 การจัดอันดับ</span>

                                <span className="px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-300">
                                    ตอบถูกครบ 10 ข้อ
                                </span>

                                <span className="text-white/40">→</span>

                                <span className="px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-300">
                                    เวลาน้อยที่สุด
                                </span>

                                <span className="text-white/40">→</span>

                                <span className="px-3 py-1 rounded-full bg-white/10 text-white/80">
                                    ส่งก่อน
                                </span>
                            </div>

                            <p className="mt-3 text-sm text-white/60">
                                * หากทำแบบทดสอบหลายครั้ง ระบบจะเลือกผลการทดสอบที่ดีที่สุดในการจัดอันดับ
                            </p>
                        </div>
                    </div>
                )}

                {/* ฟอร์มข้อมูลพนักงาน */}
                {!isStarted && (
                    <div
                        className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-sm anim-fade-up"
                        style={{ animationDelay: "0.1s" }}
                    >
                        <h2 className="text-2xl font-bold mb-5 flex items-center gap-2">
                            👤 กรอกข้อมูลพนักงาน
                        </h2>

                        <Formik
                            initialValues={initialUserInfo}
                            validationSchema={validationSchema}
                            onSubmit={handleStartQuiz}
                            enableReinitialize
                        >
                            {({ errors, touched }) => (
                                <Form>
                                    <div>
                                        <label className="block text-sm font-medium text-white/80 mb-2">
                                            รหัสพนักงาน <span className="text-red-400">*</span>
                                        </label>

                                        <Field
                                            name="employeeId"
                                            placeholder="เช่น 20000"
                                            className={`w-full rounded-2xl bg-white/10 border px-4 py-3 text-white placeholder:text-white/40 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 ${errors.employeeId && touched.employeeId
                                                ? "border-red-500"
                                                : "border-white/20"
                                                }`}
                                        />

                                        <ErrorMessage
                                            name="employeeId"
                                            component="div"
                                            className="text-red-400 text-sm mt-2"
                                        />

                                        <p className="mt-3 text-sm text-white/60">
                                            ⚠️ โปรดตรวจสอบ
                                            <span className="font-semibold text-yellow-300"> รหัสพนักงาน </span>
                                            ให้ถูกต้อง เพื่อใช้ในการ
                                            <span className="font-semibold text-white"> บันทึกผลการทดสอบและจัดอันดับ</span>
                                        </p>
                                    </div>

                                    <button
                                        type="submit"
                                        className="mt-8 w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold py-3.5 transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-yellow-500/20"
                                    >
                                        🚀 เริ่มทำแบบทดสอบ
                                    </button>
                                </Form>
                            )}
                        </Formik>
                    </div>
                )}
                {/* ===== แบบทดสอบ (ข้อ 1-10) ===== */}
                {isStarted && !isSubmitted && !showComment && (
                    <div className="space-y-8">
                        {/* Sticky Status Bar */}
                        <div className="sticky top-16 z-40 bg-[#0F0A1F]/80 backdrop-blur pt-2 pb-3 -mx-1 px-1">
                            <div className="bg-[#1F1F2E] border border-white/20 rounded-2xl px-4 py-3 shadow-lg">
                                <div className="flex justify-between items-center mb-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-yellow-400">⏱</span>
                                        <span className="font-mono font-bold">
                                            {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                    <div className="font-medium">
                                        {answeredCount}/{totalQuestions}
                                    </div>
                                </div>

                                <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                                    <div className="h-2.5 bg-gradient-to-r from-yellow-400 to-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }} />
                                </div>

                                <div className="text-[10px] text-white/50 mt-1 text-right">
                                    {progress}% สำเร็จ {progress === 100 && "🎉 ครบแล้ว! กดส่งคำตอบได้เลย"}
                                </div>
                            </div>
                        </div>

                        {/* คำถาม (เฉพาะข้อสอบ ไม่รวม Comment) */}
                        {quizQuestions.map((q, index) => (
                            <div key={q.id} ref={el => questionRefs.current[q.id] = el}
                                className={`bg-white/5 border rounded-3xl p-6 transition-all duration-300 anim-fade-up
                                    ${answers[q.id] ? "border-emerald-400/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]" : "border-white/10"}`}
                                style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}>
                                <div className="flex gap-3 mb-4">
                                    <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center font-bold transition-all
                                        ${answers[q.id] ? "bg-emerald-400 text-black scale-110" : "bg-yellow-400/10 text-yellow-400"}`}>
                                        {answers[q.id] ? "✓" : index + 1}
                                    </div>
                                    <h3 className="font-semibold text-lg">{q.question}</h3>
                                </div>

                                <div className="space-y-3">
                                    {q.options.map((option, index) => (
                                        <label
                                            key={option.id}
                                            className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer border transition-all duration-200
        ${answers[q.id] === option.id
                                                    ? "bg-yellow-400/15 border-yellow-400 scale-[1.01] shadow-[0_0_15px_rgba(250,204,21,0.15)]"
                                                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30 hover:translate-x-1"
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                checked={answers[q.id] === option.id}
                                                onChange={() => handleAnswer(q.id, option.id)}
                                                className="accent-yellow-400"
                                            />

                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-yellow-300 font-bold">
                                                    {choiceLabels[index]}
                                                </span>

                                                <span>{option.text}</span>
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

                        <button onClick={handleSubmitQuiz}
                            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-4 rounded-2xl text-lg transition-all hover:scale-[1.02] shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                            📨 ส่งคำตอบ
                        </button>
                    </div>
                )}

                {/* ===== หน้า Comment (Timer หยุดแล้ว / คะแนนคำนวณแล้วแต่ยังไม่แสดง) ===== */}
                {isStarted && !isSubmitted && showComment && (
                    <div className="anim-pop">
                        <div className="bg-white/5 border border-yellow-400/40 rounded-3xl p-6 md:p-10 anim-glow">
                            <div className="text-center mb-6">
                                <div className="text-6xl mb-3 anim-bounce inline-block">💬</div>
                                <h2 className="text-2xl md:text-3xl font-black mb-2">ก่อนดูผลคะแนน</h2>
                                <p className="text-white/70">
                                    ช่วยตอบอีก 1 คำถาม <span className="text-yellow-400">(ไม่จับเวลา)</span>
                                </p>
                                <p className="text-emerald-400 text-sm mt-1">✨ ความคิดเห็นของคุณจะช่วยพัฒนาองค์กร</p>
                            </div>

                            {/* บอกใบ้ว่าคะแนนพร้อมแล้ว สร้างความตื่นเต้น */}
                            <div className="flex items-center justify-center gap-2 mb-6 text-sm text-white/50">
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                คะแนนของคุณถูกคำนวณเรียบร้อยแล้ว รอเปิดเผยอยู่... 🔒
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
                                <h3 className="font-semibold text-lg mb-3 flex gap-2">
                                    <span className="text-yellow-400">Q:</span>
                                    การเป็น "แบบอย่างที่ดี" ในองค์กรภายใต้หลักการ GAC ควรได้รับการส่งเสริมหรือพัฒนาในรูปแบบใด
                                </h3>
                                <textarea
                                    value={comment}
                                    onChange={(e) => { setComment(e.target.value); setCommentError(""); }}
                                    placeholder="กรุณาแบ่งปันความคิดเห็นของคุณ..."
                                    className={`w-full h-36 bg-white/10 border rounded-2xl p-4 resize-y focus:outline-none focus:border-yellow-400 focus:shadow-[0_0_20px_rgba(250,204,21,0.2)] transition-all
                                        ${commentError ? "border-red-500" : "border-white/20"}`}
                                />
                                {commentError && (
                                    <div className="anim-shake text-red-400 text-sm mt-2 flex items-center gap-1">
                                        ⚠️ {commentError}
                                    </div>
                                )}
                            </div>

                            <button onClick={handleSubmitComment} disabled={isLoading}
                                className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold py-4 rounded-2xl text-lg transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 shadow-[0_0_25px_rgba(250,204,21,0.3)]">
                                🎁 ส่งความคิดเห็นและดูผลคะแนน
                            </button>
                        </div>
                    </div>
                )}

                {/* ===== ผลลัพธ์ ===== */}
                {isSubmitted && result && (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center anim-pop">
                        <h2 className="text-3xl font-bold mb-2">ทำแบบทดสอบเสร็จสิ้น!</h2>
                        <p className="text-white/60 mb-6">ขอบคุณที่ร่วมทำแบบทดสอบและแสดงความคิดเห็น</p>

                        {/* แสดงสถานะ */}
                        {result.score === 10 ? (
                            <div className="mb-6 anim-pop" style={{ animationDelay: "0.2s" }}>
                                <div className="inline-flex items-center gap-3 bg-emerald-500/10 text-emerald-400 px-8 py-3 rounded-2xl text-2xl font-bold border border-emerald-400/30 shadow-[0_0_30px_rgba(16,185,129,0.25)]">
                                    🎉 คุณผ่านแล้ว!
                                </div>
                            </div>
                        ) : (
                            <div className="mb-6 anim-pop" style={{ animationDelay: "0.2s" }}>
                                <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 px-6 py-2 rounded-2xl text-lg font-bold border border-red-400/30">
                                    ❌ คุณยังไม่ผ่าน
                                </div>
                            </div>
                        )}

                        <div className="flex justify-center gap-8 mb-8">
                            <div className="anim-pop" style={{ animationDelay: "0.35s" }}>
                                <div className={`text-6xl font-black ${result.score === 10 ? "text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]" : "text-yellow-400"}`}>{result.score}</div>
                                <div className="text-white/60">คะแนน</div>
                            </div>
                            <div className="anim-pop" style={{ animationDelay: "0.5s" }}>
                                <div className="text-6xl font-black text-white">{result.time}</div>
                                <div className="text-white/60">วินาที</div>
                            </div>
                        </div>

                        {result.score < 10 && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                                <p className="text-red-400 font-medium mb-1">คุณยังไม่ผ่าน</p>
                                <p className="text-sm text-white/70">กรุณากดปุ่มด้านล่างเพื่อทำแบบทดสอบใหม่</p>
                            </div>
                        )}

                        <div className="flex flex-col md:flex-row gap-4 justify-center">
                            <button onClick={resetQuiz} className={`px-8 py-3 rounded-2xl font-medium transition-all hover:scale-105 ${result.score < 10 ? "bg-red-500 hover:bg-red-600 text-white" : "border border-white/30 hover:bg-white/10"}`}>
                                ทำแบบทดสอบใหม่
                            </button>
                            <a href="/" className="px-8 py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold rounded-2xl hover:from-yellow-300 hover:to-amber-400 transition-all hover:scale-105 text-center">
                                🏆 ดู Leaderboard
                            </a>
                        </div>
                    </div>
                )}
            </div>

            {/* Loading Popup */}
            {isLoading && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999]">
                    <div className="bg-[#1F1F2E] border border-white/20 rounded-3xl px-8 py-8 text-center w-[280px] anim-pop">
                        <div className="flex justify-center mb-4">
                            <div className="relative w-12 h-12">
                                <div className="absolute inset-0 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">🎁</div>
                            </div>
                        </div>
                        <p className="text-lg font-medium">กำลังส่งคำตอบ...</p>
                        <p className="text-sm text-white/60 mt-1">กรุณารอสักครู่</p>
                    </div>
                </div>
            )}
        </div>
    );
}