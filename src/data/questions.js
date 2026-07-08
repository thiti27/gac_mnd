const questions = [
    {
        id: 1,
        question: "M&D Compliant มีวัตถุประสงค์หลักเพื่ออะไร?",
        options: [
            { id: "A", text: "สร้างวัฒนธรรมองค์กรที่ดีและส่งเสริมการปฏิบัติตามกฎระเบียบ /", correct: true },
            { id: "B", text: "เพิ่มจำนวนเอกสาร", correct: false },
            { id: "C", text: "ลดเวลาพักของพนักงาน", correct: false },
            { id: "D", text: "เพิ่มขั้นตอนการทำงานโดยไม่จำเป็น", correct: false },
        ],
    },
    {
        id: 2,
        question: "เมื่อพบเห็นพฤติกรรมที่ไม่เป็นไปตาม Compliance ควรทำอย่างไร?",
        options: [
            { id: "A", text: "เพิกเฉย", correct: false },
            { id: "B", text: "แจ้งหัวหน้างานหรือผู้รับผิดชอบทันที /", correct: true },
            { id: "C", text: "บอกเฉพาะเพื่อนร่วมงาน", correct: false },
            { id: "D", text: "โพสต์ลงโซเชียลมีเดีย", correct: false },
        ],
    },
    {
        id: 3,
        question: "การทักทายเพื่อนร่วมงานทุกวันช่วยส่งเสริมอะไร?",
        options: [
            { id: "A", text: "ลดการสื่อสาร", correct: false },
            { id: "B", text: "สร้างความสัมพันธ์ที่ดีและบรรยากาศการทำงาน /", correct: true },
            { id: "C", text: "เพิ่มภาระงาน", correct: false },
            { id: "D", text: "ทำให้ประชุมบ่อยขึ้น", correct: false },
        ],
    },
    {
        id: 4,
        question: "ข้อใดเป็นตัวอย่างของการปฏิบัติตาม Compliance?",
        options: [
            { id: "A", text: "ปฏิบัติตามกฎ ระเบียบ และนโยบายของบริษัท /", correct: true },
            { id: "B", text: "ข้ามขั้นตอนการทำงานเพื่อความรวดเร็ว", correct: false },
            { id: "C", text: "ใช้รหัสผ่านร่วมกับเพื่อน", correct: false },
            { id: "D", text: "นำข้อมูลบริษัทไปเผยแพร่ภายนอก", correct: false },
        ],
    },
    {
        id: 5,
        question: "หากพบข้อมูลสำคัญของบริษัทถูกเปิดเผยโดยไม่ได้รับอนุญาต ควรทำอย่างไร?",
        options: [
            { id: "A", text: "ไม่ต้องทำอะไร", correct: false },
            { id: "B", text: "แจ้งผู้รับผิดชอบหรือฝ่ายที่เกี่ยวข้องทันที /", correct: true },
            { id: "C", text: "แชร์ต่อให้เพื่อนร่วมงาน", correct: false },
            { id: "D", text: "ลบหลักฐานทั้งหมด", correct: false },
        ],
    },
    {
        id: 6,
        question: "การช่วยเหลือและให้เกียรติเพื่อนร่วมงานสะท้อนถึงข้อใด?",
        options: [
            { id: "A", text: "Morale & Discipline ที่ดี /", correct: true },
            { id: "B", text: "การแข่งขันที่รุนแรง", correct: false },
            { id: "C", text: "การหลีกเลี่ยงความรับผิดชอบ", correct: false },
            { id: "D", text: "การทำงานคนเดียว", correct: false },
        ],
    },
    {
        id: 7,
        question: "การรักษาความลับของบริษัทเป็นหน้าที่ของใคร?",
        options: [
            { id: "A", text: "เฉพาะผู้จัดการ", correct: false },
            { id: "B", text: "เฉพาะฝ่าย IT", correct: false },
            { id: "C", text: "พนักงานทุกคน /", correct: true },
            { id: "D", text: "เฉพาะฝ่ายบุคคล", correct: false },
        ],
    },
    {
        id: 8,
        question: "ข้อใดเป็นพฤติกรรมที่ช่วยสร้างวัฒนธรรมองค์กรที่ดี?",
        options: [
            { id: "A", text: "เคารพซึ่งกันและกัน และสื่อสารอย่างสุภาพ /", correct: true },
            { id: "B", text: "พูดลับหลังเพื่อนร่วมงาน", correct: false },
            { id: "C", text: "เพิกเฉยต่อปัญหา", correct: false },
            { id: "D", text: "หลีกเลี่ยงการทำงานเป็นทีม", correct: false },
        ],
    },
    {
        id: 9,
        question: "คำขวัญ 'ทักทายกันทุกวัน สร้างสัมพันธ์ที่ดี' ต้องการสื่อถึงอะไร?",
        options: [
            { id: "A", text: "เริ่มต้นวันใหม่ด้วยรอยยิ้มและการทักทาย เพื่อสร้างความสัมพันธ์ที่ดีในองค์กร /", correct: true },
            { id: "B", text: "ลดการพูดคุยระหว่างเพื่อนร่วมงาน", correct: false },
            { id: "C", text: "ทำงานโดยไม่ต้องสื่อสาร", correct: false },
            { id: "D", text: "ทักทายเฉพาะหัวหน้างาน", correct: false },
        ],
    },
    {
        id: 10,
        question: "คุณอยากเห็นกิจกรรมอะไรใน M&D Compliance Season 5?",
        type: "comment",
        placeholder: "ข้อเสนอแนะอื่นๆ",
    },
];


export default questions;