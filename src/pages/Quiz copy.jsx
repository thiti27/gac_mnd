import { useState, useRef, useEffect } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import Select from "react-select";
import questions from "../data/questions";
import confetti from "canvas-confetti";


const sendToSupabase = async (data) => {
    const { error } = await supabase
        .from("quiz_results")
        .insert([data]);

    if (error) {
        console.error(error);
        throw error;
    }

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

    const questionRefs = useRef({});
    const timerRef = useRef(null);

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

    // Timer
    useEffect(() => {
        if (isStarted && !isSubmitted) {
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isStarted, isSubmitted]);

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

    const answeredCount = Object.keys(answers).length + (comment.trim() ? 1 : 0);
    const progress = Math.round((answeredCount / 10) * 100);

    const validateAnswers = () => {
        const unanswered = questions
            .filter(q => q.type !== "comment" && !answers[q.id])
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

    const handleSubmitQuiz = async () => {
        if (!validateAnswers()) return;

        setIsLoading(true);

        const endTime = Date.now();
        const timeTaken = Math.floor((endTime - startTime) / 1000);

        let score = 0;
        questions.forEach(q => {
            if (q.type === "comment") return;
            const selected = answers[q.id];
            const correctOption = q.options.find(opt => opt.correct);
            if (selected === correctOption?.id) score++;
        });

        const finalScore = Math.round((score / 9) * 10);

        const attemptData = {
            employee_id: userInfo.employeeId,
            score: pendingResult.score,
            time: pendingResult.timeTaken,
            comment: comment.trim(),
        };

        try {
            const resultFromSheet = await sendToSupabase(attemptData);

            const existingAttempts = JSON.parse(localStorage.getItem("attempts")) || [];
            localStorage.setItem("attempts", JSON.stringify([...existingAttempts, attemptData]));

            setResult({
                score: finalScore,
                time: timeTaken,
                rank: resultFromSheet.rank,
                totalParticipants: resultFromSheet.total,
            });

            setIsSubmitted(true);

            // ยิงพลุเมื่อได้ 10 คะแนน
            if (finalScore === 10) {
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
        <div className="min-h-screen bg-[#0F0A1F] text-white p-6 md:p-8">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-black text-center mb-2">Quiz</h1>
                <p className="text-center text-white/60 mb-8">แบบทดสอบ M&D and Compliance</p>

                {/* กติกา */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 mb-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span>📋</span> กติกาการทำแบบทดสอบ
                    </h2>
                    <ul className="space-y-2.5 text-white/80 text-sm md:text-base">
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-400 mt-1">•</span>
                            แบบทดสอบมีทั้งหมด <span className="font-semibold text-white">10 ข้อ</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-400 mt-1">•</span>
                            ต้องตอบให้<strong className="text-white">ถูกครบ 10 ข้อ</strong> จึงจะผ่าน
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-400 mt-1">•</span>
                            หากทำครั้งแรกไม่ถึง 10 ข้อ <strong className="text-emerald-400">สามารถทำใหม่ได้</strong> ไม่จำกัดจำนวนครั้ง
                        </li>
                    </ul>
                </div>

                {/* ฟอร์มข้อมูลพนักงาน */}
                {!isStarted && (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8">
                        <h2 className="text-xl font-bold mb-4">กรอกข้อมูลพนักงาน</h2>

                        <Formik
                            initialValues={initialUserInfo}
                            validationSchema={validationSchema}
                            onSubmit={handleStartQuiz}
                            enableReinitialize
                        >
                            {({ setFieldValue, values, errors, touched }) => (
                                <Form>
                                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-sm text-white/70 mb-1">รหัสพนักงาน *</label>
                                            <Field name="employeeId" className={`w-full bg-white/10 border rounded-2xl px-4 py-3 ${errors.employeeId && touched.employeeId ? "border-red-500" : "border-white/20"}`} placeholder="เช่น 20000" />
                                            <ErrorMessage name="employeeId" component="div" className="text-red-400 text-sm mt-1" />
                                        </div>




                                    </div>

                                    <button type="submit" className="mt-6 w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3.5 rounded-2xl transition">
                                        เริ่มทำแบบทดสอบ
                                    </button>
                                </Form>
                            )}
                        </Formik>
                    </div>
                )}

                {/* แบบทดสอบ */}
                {isStarted && !isSubmitted && (
                    <div className="space-y-8">
                        {/* Sticky Status Bar */}
                        <div className="sticky top-16 z-40 bg-[#0F0A1F] pt-2 pb-3 -mx-1 px-1">
                            <div className="bg-[#1F1F2E] border border-white/20 rounded-2xl px-4 py-3 shadow-lg">
                                <div className="flex justify-between items-center mb-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-yellow-400">⏱</span>
                                        <span className="font-mono font-bold">
                                            {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                    <div className="font-medium">
                                        {answeredCount}/10
                                    </div>
                                </div>

                                <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                                    <div className="h-2.5 bg-gradient-to-r from-yellow-400 to-emerald-400 transition-all duration-300" style={{ width: `${progress}%` }} />
                                </div>

                                <div className="text-[10px] text-white/50 mt-1 text-right">
                                    {progress}% สำเร็จ
                                </div>
                            </div>
                        </div>

                        {/* คำถาม */}
                        {questions.map((q, index) => (
                            <div key={q.id} ref={el => questionRefs.current[q.id] = el} className="bg-white/5 border border-white/10 rounded-3xl p-6">
                                <div className="flex gap-3 mb-4">
                                    <div className="w-8 h-8 flex-shrink-0 bg-yellow-400/10 text-yellow-400 rounded-full flex items-center justify-center font-bold">
                                        {index + 1}
                                    </div>
                                    <h3 className="font-semibold text-lg">{q.question}</h3>
                                </div>

                                {q.type !== "comment" && (
                                    <div className="space-y-3">
                                        {q.options.map((option) => (
                                            <label key={option.id} className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer border transition ${answers[q.id] === option.id ? "bg-yellow-400/10 border-yellow-400" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
                                                <input type="radio" checked={answers[q.id] === option.id} onChange={() => handleAnswer(q.id, option.id)} className="accent-yellow-400" />
                                                <span>{option.text}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {q.type === "comment" && (
                                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={q.placeholder} className="w-full h-32 bg-white/10 border border-white/20 rounded-2xl p-4 resize-y focus:outline-none focus:border-yellow-400" />
                                )}
                            </div>
                        ))}

                        <button onClick={handleSubmitQuiz} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl text-lg transition">
                            ส่งคำตอบ
                        </button>
                    </div>
                )}

                {/* ผลลัพธ์ */}
                {isSubmitted && result && (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
                        <h2 className="text-3xl font-bold mb-2">ทำแบบทดสอบเสร็จสิ้น!</h2>
                        <p className="text-white/60 mb-6">ขอบคุณที่ร่วมทำแบบทดสอบ</p>

                        {/* แสดงสถานะ */}
                        {result.score === 10 ? (
                            <div className="mb-6">
                                <div className="inline-flex items-center gap-3 bg-emerald-500/10 text-emerald-400 px-8 py-3 rounded-2xl text-2xl font-bold">
                                    🎉 คุณผ่านแล้ว!
                                </div>
                            </div>
                        ) : (
                            <div className="mb-6">
                                <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 px-6 py-2 rounded-2xl text-lg font-bold">
                                    ❌ คุณยังไม่ผ่าน
                                </div>
                            </div>
                        )}

                        <div className="flex justify-center gap-8 mb-6">
                            <div>
                                <div className="text-6xl font-black text-yellow-400">{result.score}</div>
                                <div className="text-white/60">คะแนน</div>
                            </div>
                            <div>
                                <div className="text-6xl font-black text-white">{result.time}</div>
                                <div className="text-white/60">วินาที</div>
                            </div>
                        </div>

                        <div className="mb-8">
                            <p className="text-white/60">คุณอยู่อันดับ</p>
                            <div className="text-7xl font-black text-yellow-400">#{result.rank}</div>
                        </div>

                        {result.score < 10 && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                                <p className="text-red-400 font-medium mb-1">คุณยังไม่ผ่าน</p>
                                <p className="text-sm text-white/70">กรุณากดปุ่มด้านล่างเพื่อทำแบบทดสอบใหม่</p>
                            </div>
                        )}

                        <div className="flex flex-col md:flex-row gap-4 justify-center">
                            <button onClick={resetQuiz} className={`px-8 py-3 rounded-2xl font-medium transition ${result.score < 10 ? "bg-red-500 hover:bg-red-600 text-white" : "border border-white/30 hover:bg-white/10"}`}>
                                ทำแบบทดสอบใหม่
                            </button>
                            <a href="/" className="px-8 py-3 bg-yellow-400 text-black font-bold rounded-2xl hover:bg-yellow-500 transition text-center">
                                ดู Leaderboard
                            </a>
                        </div>
                    </div>
                )}
            </div>

            {/* Loading Popup */}
            {isLoading && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]">
                    <div className="bg-[#1F1F2E] border border-white/20 rounded-3xl px-8 py-8 text-center w-[280px]">
                        <div className="flex justify-center mb-4">
                            <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <p className="text-lg font-medium">กำลังส่งคำตอบ...</p>
                        <p className="text-sm text-white/60 mt-1">กรุณารอสักครู่</p>
                    </div>
                </div>
            )}
        </div>
    );
}