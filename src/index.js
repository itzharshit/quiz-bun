// src/index.js
import { Elysia } from "elysia";
import { Low, JSONFile } from 'lowdb';
import { join } from 'path';

// Define the database schema
interface MCQ {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  marks: number;
  negativeMarking: boolean;
  categoryId: string;
  subcategoryId: string;
  subjectId: string;
  chapterId: string;
}

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
}

interface Subject {
  id: string;
  subcategoryId: string;
  name: string;
}

interface Chapter {
  id: string;
  subjectId: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
  email: string;
  course: string; // e.g., CA Foundation
  quizAttempts: {
    [quizId: string]: {
      marksObtained: number;
      // ... other details
    };
  };
}

interface Settings {
  negativeMarkingGlobal: boolean;
}

interface DatabaseSchema {
  mcqs: MCQ[];
  categories: Category[];
  subcategories: Subcategory[];
  subjects: Subject[];
  chapters: Chapter[];
  students: Student[];
  settings: Settings;
}

// Initialize lowdb
const file = join(__dirname, 'db.json');
const adapter = new JSONFile<DatabaseSchema>(file);
const db = new Low(adapter);

async function initializeDatabase() {
  await db.read();
  db.data ||= {
    mcqs: [],
    categories: [],
    subcategories: [],
    subjects: [],
    chapters: [],
    students: [],
    settings: { negativeMarkingGlobal: false },
  };
  await db.write();
}

initializeDatabase();

const app = new Elysia()
  .get("/", () => "Hello from Bun!")

  // --- Admin Panel Endpoints ---

  // 1. Hierarchical Structure Management
  .group("/admin/categories", app => app
    .get("/", () => db.data.categories)
    .post("/", async ({ body }) => {
      const newCategory = { id: crypto.randomUUID(), ...body as { name: string } };
      db.data.categories.push(newCategory);
      await db.write();
      return newCategory;
    })
    // ... (PUT, DELETE for categories)
  )

  .group("/admin/subcategories", app => app
    .get("/", () => db.data.subcategories)
    .post("/", async ({ body }) => {
      const newSubcategory = { id: crypto.randomUUID(), ...body as { categoryId: string, name: string } };
      db.data.subcategories.push(newSubcategory);
      await db.write();
      return newSubcategory;
    })
    // ... (PUT, DELETE for subcategories)
  )

  .group("/admin/subjects", app => app
    .get("/", () => db.data.subjects)
    .post("/", async ({ body }) => {
      const newSubject = { id: crypto.randomUUID(), ...body as { subcategoryId: string, name: string } };
      db.data.subjects.push(newSubject);
      await db.write();
      return newSubject;
    })
    // ... (PUT, DELETE for subjects)
  )

  .group("/admin/chapters", app => app
    .get("/", () => db.data.chapters)
    .post("/", async ({ body }) => {
      const newChapter = { id: crypto.randomUUID(), ...body as { subjectId: string, name: string } };
      db.data.chapters.push(newChapter);
      await db.write();
      return newChapter;
    })
    // ... (PUT, DELETE for chapters)
  )

  // 2. MCQ Management
  .group("/admin/mcqs", app => app
    .get("/", () => db.data.mcqs)
    .post("/", async ({ body }) => {
      const newMcq = { id: crypto.randomUUID(), ...(body as Omit<MCQ, 'id'>) };
      db.data.mcqs.push(newMcq);
      await db.write();
      return newMcq;
    })
    .put("/:id", async ({ params: { id }, body }) => {
      const index = db.data.mcqs.findIndex(mcq => mcq.id === id);
      if (index !== -1) {
        db.data.mcqs[index] = { ...db.data.mcqs[index], ...(body as Partial<MCQ>) };
        await db.write();
        return db.data.mcqs[index];
      }
      return { message: "MCQ not found" };
    })
    .delete("/:id", async ({ params: { id } }) => {
      db.data.mcqs = db.data.mcqs.filter(mcq => mcq.id !== id);
      await db.write();
      return { message: "MCQ deleted" };
    })
  )

  // 3. Student Details
  .get("/admin/students", () => db.data.students)
  .get("/admin/students/:id", ({ params: { id } }) => db.data.students.find(student => student.id === id))
  // ... (Potentially more endpoints for student details)

  // 4. Settings Control
  .group("/admin/settings", app => app
    .get("/", () => db.data.settings)
    .put("/", async ({ body }) => {
      db.data.settings = { ...db.data.settings, ...(body as Partial<Settings>) };
      await db.write();
      return db.data.settings;
    })
  )

  // --- User Panel Endpoints ---

  // 1. Fetching Hierarchical Data
  .get("/categories", () => db.data.categories)
  .get("/subcategories/:categoryId", ({ params: { categoryId } }) =>
    db.data.subcategories.filter(sub => sub.categoryId === categoryId)
  )
  .get("/subjects/:subcategoryId", ({ params: { subcategoryId } }) =>
    db.data.subjects.filter(sub => sub.subcategoryId === subcategoryId)
  )
  .get("/chapters/:subjectId", ({ params: { subjectId } }) =>
    db.data.chapters.filter(chapter => chapter.subjectId === subjectId)
  )

  // 2. Fetching MCQs for a Chapter (one by one will be handled on the frontend)
  .get("/mcqs/:chapterId", ({ params: { chapterId } }) =>
    db.data.mcqs.filter(mcq => mcq.chapterId === chapterId)
  )

  // 3. Submitting Quiz and Getting Results
  .post("/submit-quiz", async ({ body }) => {
    const { chapterId, studentAnswers } = body as { chapterId: string; studentAnswers: { [mcqId: string]: number } };
    const mcqsInChapter = db.data.mcqs.filter(mcq => mcq.chapterId === chapterId);
    let totalMarks = 0;
    const results = {};

    for (const mcq of mcqsInChapter) {
      const selectedAnswer = studentAnswers[mcq.id];
      const isCorrect = selectedAnswer === mcq.correctAnswer;
      results[mcq.id] = {
        correct: isCorrect,
        correctAnswer: mcq.correctAnswer,
      };
      if (isCorrect) {
        totalMarks += mcq.marks;
      } else if (mcq.negativeMarking || db.data.settings.negativeMarkingGlobal) {
        totalMarks -= (mcq.marks * 0.25); // Example negative marking of 25%
      }
    }

    // You'd also want to update the student's quiz attempts in the database
    // (This part requires student authentication which is not covered in this basic structure)

    return { totalMarks, results };
  })

  .listen(3000, () => {
    console.log("Server started on port 3000");
  });

// To run this: `bun run src/index.js`