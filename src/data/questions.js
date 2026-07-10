const questions = [
    {
        id: 1,
        question: "หลักการ “GAC” ที่ใช้ในองค์กร ย่อมาจากอะไร?",
        options: [
            { id: "A", text: "ก) Good – Action – Control", correct: false },
            { id: "B", text: "ข) Good – Awareness – Cultivating", correct: true },
            { id: "C", text: "ค) Growth – Ability – Change", correct: false },
            { id: "D", text: "ง) Goal – Action – Commitment", correct: false },
        ],
    },
    {
        id: 2,
        question: "3C: Change Challenge Courage สื่อถึงแนวคิดแบบใด?",
        options: [
            { id: "A", text: "ก) ทำงานตามคำสั่งเท่านั้น", correct: false },
            { id: "B", text: "ข) หลีกเลี่ยงความเสี่ยง", correct: false },
            { id: "C", text: "ค) กล้าปรับปรุงและท้าทายการเปลี่ยนแปลง", correct: true },
            { id: "D", text: "ง) เน้นทำงานคนเดียว", correct: false },
        ],
    },
    {
        id: 3,
        question: "แนวคิด “เหตุร้ายแจ้งให้เร็ว แจ้งให้ไว” มีจุดประสงค์หลักคืออะไร?",
        options: [
            { id: "A", text: "ก) ลดงานของพนักงาน", correct: false },
            { id: "B", text: "ข) ป้องกันและแก้ไขปัญหาได้รวดเร็ว", correct: true },
            { id: "C", text: "ค) เพิ่มเอกสารงาน", correct: false },
            { id: "D", text: "ง) ใช้ควบคุมพนักงาน", correct: false },
        ],
    },
    {
        id: 4,
        question: "การ “ทักทาย” ในที่ทำงานช่วยในเรื่องใด?",
        options: [
            { id: "A", text: "ก) ลดงาน", correct: false },
            { id: "B", text: "ข) สร้างความสัมพันธ์ที่ดี", correct: true },
            { id: "C", text: "ค) เพิ่มการแข่งขัน", correct: false },
            { id: "D", text: "ง) ทำให้เสียเวลา", correct: false },
        ],
    },
    {
        id: 5,
        question: "หากพบปัญหาในหน้างาน ควรปฏิบัติอย่างไรตามหลักการ GAC ขององค์กร?",
        options: [
            { id: "A", text: "ก) เก็บไว้แก้เอง", correct: false },
            { id: "B", text: "ข) แจ้งเมื่อมีคนถาม", correct: false },
            { id: "C", text: "ค) แจ้งให้เร็ว แจ้งให้ไว", correct: true },
            { id: "D", text: "ง) รอให้หัวหน้ามาเห็น", correct: false },
        ],
    },
    {
        id: 6,
        question: "กิจกรรม “กล้าคิด กล้าพูด กล้าทำ” สนับสนุนให้พนักงานเสนอไอเดียใหม่ ๆ อย่างไรในองค์กร?",
        options: [
            { id: "A", text: "ก) เปิดโอกาสให้พนักงานแสดงความคิดเห็นและนำเสนอแนวคิดใหม่ได้อย่างอิสระ", correct: true },
            { id: "B", text: "ข) จำกัดการเสนอความคิดเห็นเฉพาะหัวหน้างานเท่านั้น", correct: false },
            { id: "C", text: "ค) เน้นให้ทำตามขั้นตอนเดิมโดยไม่เปลี่ยนแปลง", correct: false },
            { id: "D", text: "ง) ให้เสนอไอเดียเฉพาะในช่วงประเมินผลงาน", correct: false },
        ],
    },
    {
        id: 7,
        question: "กิจกรรมที่รณรงค์ให้ “ทำตามกฎ” สะท้อนให้เห็นแนวคิดในด้านใด?",
        options: [
            { id: "A", text: "ก) การตัดสินใจเชิงสร้างสรรค์", correct: false },
            { id: "B", text: "ข) การยึดมั่นในระเบียบและวินัย", correct: true },
            { id: "C", text: "ค) การสื่อสารระหว่างบุคคล", correct: false },
            { id: "D", text: "ง) การคิดเชิงนวัตกรรม", correct: false },
        ],
    },
    {
        id: 8,
        question: "วัฒนธรรมองค์กรแห่งจิตสำนึกที่ยั่งยืน (GAC) ต้องการให้พนักงานมีแนวคิดแบบใดในการทำงาน?",
        options: [
            { id: "A", text: "ก) ทำเฉพาะหน้าที่", correct: false },
            { id: "B", text: "ข) หลีกเลี่ยงความเปลี่ยนแปลง", correct: false },
            { id: "C", text: "ค) มีความคิดดี ทำแต่สิ่งดี ๆ และมีจิตสำนึกดี", correct: true },
            { id: "D", text: "ง) แข่งขันอย่างเดียว", correct: false },
        ],
    },
    {
        id: 9,
        question: "ข้อใดแสดงถึงการนำค่านิยมองค์กรไปปฏิบัติได้ถูกต้องที่สุด?",
        options: [
            { id: "A", text: "ก) ปฏิบัติตามกฎ มีน้ำใจ และกล้าแสดงความคิดอย่างสร้างสรรค์", correct: true },
            { id: "B", text: "ข) ทำงานตามคำสั่งโดยไม่แสดงความคิดเห็น", correct: false },
            { id: "C", text: "ค) เน้นผลลัพธ์โดยไม่สนใจกระบวนการ", correct: false },
            { id: "D", text: "ง) หลีกเลี่ยงการทำงานร่วมกับผู้อื่น", correct: false },
        ],
    },
    {
        id: 10,
        question: "ในสถานการณ์ที่ต้องเร่งทำงานให้ทันเวลา แต่มีขั้นตอนบางอย่างขัดกับกฎ คุณควรตัดสินใจอย่างไร?",
        options: [
            { id: "A", text: "ก) ข้ามกฎเพื่อให้งานเสร็จเร็ว", correct: false },
            { id: "B", text: "ข) ทำตามขั้นตอนขององค์กรอย่างเคร่งครัด แม้ต้องใช้เวลามากขึ้น", correct: true },
            { id: "C", text: "ค) เลือกเฉพาะกฎที่สำคัญ", correct: false },
            { id: "D", text: "ง) ให้ทีมตัดสินใจเอง", correct: false },
        ],
    },
];

export default questions;