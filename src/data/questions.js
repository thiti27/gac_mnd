// เนื้อหาคำถาม/ตัวเลือกสองภาษา — ทีม compliance ควรตรวจทานคำแปลภาษาอังกฤษก่อนใช้งานจริง
const questions = [
    {
        id: 1,
        question: {
            th: "หลักการ “GAC” ที่ใช้ในองค์กร ย่อมาจากอะไร?",
            en: "What does the organization's “GAC” principle stand for?",
        },
        options: [
            { id: "A", text: { th: "Good – Action – Control", en: "Good – Action – Control" }, correct: false },
            { id: "B", text: { th: "Good – Awareness – Cultivating", en: "Good – Awareness – Cultivating" }, correct: true },
            { id: "C", text: { th: "Growth – Ability – Change", en: "Growth – Ability – Change" }, correct: false },
            { id: "D", text: { th: "Goal – Action – Commitment", en: "Goal – Action – Commitment" }, correct: false },
        ],
    },
    {
        id: 2,
        question: {
            th: "3C: Change Challenge Courage สื่อถึงแนวคิดแบบใด?",
            en: "What idea does 3C: Change, Challenge, Courage represent?",
        },
        options: [
            { id: "A", text: { th: "ทำงานตามคำสั่งเท่านั้น", en: "Only working as instructed" }, correct: false },
            { id: "B", text: { th: "หลีกเลี่ยงความเสี่ยง", en: "Avoiding risk" }, correct: false },
            { id: "C", text: { th: "กล้าปรับปรุงและท้าทายการเปลี่ยนแปลง", en: "Daring to improve and embrace change" }, correct: true },
            { id: "D", text: { th: "เน้นทำงานคนเดียว", en: "Focusing on working alone" }, correct: false },
        ],
    },
    {
        id: 3,
        question: {
            th: "แนวคิด “เหตุร้ายแจ้งให้เร็ว แจ้งให้ไว” มีจุดประสงค์หลักคืออะไร?",
            en: "What is the main purpose of the “report incidents quickly” principle?",
        },
        options: [
            { id: "A", text: { th: "ลดงานของพนักงาน", en: "To reduce employees' workload" }, correct: false },
            { id: "B", text: { th: "ป้องกันและแก้ไขปัญหาได้รวดเร็ว", en: "To prevent and resolve problems quickly" }, correct: true },
            { id: "C", text: { th: "เพิ่มเอกสารงาน", en: "To increase paperwork" }, correct: false },
            { id: "D", text: { th: "ใช้ควบคุมพนักงาน", en: "To control employees" }, correct: false },
        ],
    },
    {
        id: 4,
        question: {
            th: "การ “ทักทาย” ในที่ทำงานช่วยในเรื่องใด?",
            en: "What does “greeting” others at work help with?",
        },
        options: [
            { id: "A", text: { th: "ลดงาน", en: "Reducing workload" }, correct: false },
            { id: "B", text: { th: "สร้างความสัมพันธ์ที่ดี", en: "Building good relationships" }, correct: true },
            { id: "C", text: { th: "เพิ่มการแข่งขัน", en: "Increasing competition" }, correct: false },
            { id: "D", text: { th: "ทำให้เสียเวลา", en: "Wasting time" }, correct: false },
        ],
    },
    {
        id: 5,
        question: {
            th: "หากพบปัญหาในหน้างาน ควรปฏิบัติอย่างไรตามหลักการ GAC ขององค์กร?",
            en: "If you find a problem on the job, what should you do according to the organization's GAC principle?",
        },
        options: [
            { id: "A", text: { th: "เก็บไว้แก้เอง", en: "Keep it and fix it yourself" }, correct: false },
            { id: "B", text: { th: "แจ้งเมื่อมีคนถาม", en: "Report only when someone asks" }, correct: false },
            { id: "C", text: { th: "แจ้งให้เร็ว แจ้งให้ไว", en: "Report it quickly, right away" }, correct: true },
            { id: "D", text: { th: "รอให้หัวหน้ามาเห็น", en: "Wait for a supervisor to notice" }, correct: false },
        ],
    },
    {
        id: 6,
        question: {
            th: "กิจกรรม “กล้าคิด กล้าพูด กล้าทำ” สนับสนุนให้พนักงานเสนอไอเดียใหม่ ๆ อย่างไรในองค์กร?",
            en: "How does the “dare to think, speak, and act” activity encourage employees to propose new ideas in the organization?",
        },
        options: [
            { id: "A", text: { th: "เปิดโอกาสให้พนักงานแสดงความคิดเห็นและนำเสนอแนวคิดใหม่ได้อย่างอิสระ", en: "By giving employees the freedom to share opinions and propose new ideas" }, correct: true },
            { id: "B", text: { th: "จำกัดการเสนอความคิดเห็นเฉพาะหัวหน้างานเท่านั้น", en: "By limiting idea-sharing to supervisors only" }, correct: false },
            { id: "C", text: { th: "เน้นให้ทำตามขั้นตอนเดิมโดยไม่เปลี่ยนแปลง", en: "By emphasizing following the same old process without change" }, correct: false },
            { id: "D", text: { th: "ให้เสนอไอเดียเฉพาะในช่วงประเมินผลงาน", en: "By allowing ideas only during performance reviews" }, correct: false },
        ],
    },
    {
        id: 7,
        question: {
            th: "กิจกรรมที่รณรงค์ให้ “ทำตามกฎ” สะท้อนให้เห็นแนวคิดในด้านใด?",
            en: "The campaign encouraging people to “follow the rules” reflects which concept?",
        },
        options: [
            { id: "A", text: { th: "การตัดสินใจเชิงสร้างสรรค์", en: "Creative decision-making" }, correct: false },
            { id: "B", text: { th: "การยึดมั่นในระเบียบและวินัย", en: "Adherence to rules and discipline" }, correct: true },
            { id: "C", text: { th: "การสื่อสารระหว่างบุคคล", en: "Interpersonal communication" }, correct: false },
            { id: "D", text: { th: "การคิดเชิงนวัตกรรม", en: "Innovative thinking" }, correct: false },
        ],
    },
    {
        id: 8,
        question: {
            th: "วัฒนธรรมองค์กรแห่งจิตสำนึกที่ยั่งยืน (GAC) ต้องการให้พนักงานมีแนวคิดแบบใดในการทำงาน?",
            en: "What mindset does the organization's culture of sustainable awareness (GAC) want employees to have at work?",
        },
        options: [
            { id: "A", text: { th: "ทำเฉพาะหน้าที่", en: "Doing only their assigned duties" }, correct: false },
            { id: "B", text: { th: "หลีกเลี่ยงความเปลี่ยนแปลง", en: "Avoiding change" }, correct: false },
            { id: "C", text: { th: "มีความคิดดี ทำแต่สิ่งดี ๆ และมีจิตสำนึกดี", en: "Thinking well, doing good things, and having good awareness" }, correct: true },
            { id: "D", text: { th: "แข่งขันอย่างเดียว", en: "Only competing" }, correct: false },
        ],
    },
    {
        id: 9,
        question: {
            th: "ข้อใดแสดงถึงการนำค่านิยมองค์กรไปปฏิบัติได้ถูกต้องที่สุด?",
            en: "Which option best reflects correctly applying the organization's values in practice?",
        },
        options: [
            { id: "A", text: { th: "ปฏิบัติตามกฎ มีน้ำใจ และกล้าแสดงความคิดอย่างสร้างสรรค์", en: "Following the rules, being kind, and daring to share ideas constructively" }, correct: true },
            { id: "B", text: { th: "ทำงานตามคำสั่งโดยไม่แสดงความคิดเห็น", en: "Working as instructed without sharing opinions" }, correct: false },
            { id: "C", text: { th: "เน้นผลลัพธ์โดยไม่สนใจกระบวนการ", en: "Focusing on results while ignoring the process" }, correct: false },
            { id: "D", text: { th: "หลีกเลี่ยงการทำงานร่วมกับผู้อื่น", en: "Avoiding working together with others" }, correct: false },
        ],
    },
    {
        id: 10,
        question: {
            th: "ในสถานการณ์ที่ต้องเร่งทำงานให้ทันเวลา แต่มีขั้นตอนบางอย่างขัดกับกฎ คุณควรตัดสินใจอย่างไร?",
            en: "When you must rush to finish work on time but a step conflicts with the rules, what should you decide to do?",
        },
        options: [
            { id: "A", text: { th: "ข้ามกฎเพื่อให้งานเสร็จเร็ว", en: "Skip the rule to finish the work faster" }, correct: false },
            { id: "B", text: { th: "ทำตามขั้นตอนขององค์กรอย่างเคร่งครัด แม้ต้องใช้เวลามากขึ้น", en: "Strictly follow the organization's process, even if it takes longer" }, correct: true },
            { id: "C", text: { th: "เลือกเฉพาะกฎที่สำคัญ", en: "Only follow the rules that seem important" }, correct: false },
            { id: "D", text: { th: "ให้ทีมตัดสินใจเอง", en: "Let the team decide on their own" }, correct: false },
        ],
    },
];

export default questions;
