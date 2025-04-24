// src/index.js
import { Elysia } from "elysia";
import { Low, JSONFile } from 'lowdb';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Database schema
const schema = {
  mcqs: [],
  categories: [],
  subcategories: [],
  subjects: [],
  chapters: [],
  students: [],
  settings: { negativeMarkingGlobal: false }
};

// Initialize database
const file = join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter);
db.data ||= schema;

// Helper functions
const findEntity = (collection, id) => db.data[collection].find(item => item.id === id);
const filterEntities = (collection, field, value) => db.data[collection].filter(item => item[field] === value);

const app = new Elysia()
  // Admin Endpoints
  // Categories
  .group('/admin/categories', app => app
    .get('/', () => db.data.categories)
    .post('/', async ({ body }) => {
      const category = { id: crypto.randomUUID(), ...body };
      db.data.categories.push(category);
      await db.write();
      return category;
    })
    .put('/:id', async ({ params: { id }, body }) => {
      const index = db.data.categories.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Category not found');
      db.data.categories[index] = { ...db.data.categories[index], ...body };
      await db.write();
      return db.data.categories[index];
    })
    .delete('/:id', async ({ params: { id } }) => {
      db.data.categories = db.data.categories.filter(c => c.id !== id);
      await db.write();
      return { success: true };
    })
  )

  // Subcategories
  .group('/admin/subcategories', app => app
    .get('/', () => db.data.subcategories)
    .post('/', async ({ body }) => {
      if (!findEntity('categories', body.categoryId)) throw new Error('Category not found');
      const subcategory = { id: crypto.randomUUID(), ...body };
      db.data.subcategories.push(subcategory);
      await db.write();
      return subcategory;
    })
    .put('/:id', async ({ params: { id }, body }) => {
      const index = db.data.subcategories.findIndex(s => s.id === id);
      if (index === -1) throw new Error('Subcategory not found');
      db.data.subcategories[index] = { ...db.data.subcategories[index], ...body };
      await db.write();
      return db.data.subcategories[index];
    })
    .delete('/:id', async ({ params: { id } }) => {
      db.data.subcategories = db.data.subcategories.filter(s => s.id !== id);
      await db.write();
      return { success: true };
    })
  )

  // Subjects
  .group('/admin/subjects', app => app
    .get('/', () => db.data.subjects)
    .post('/', async ({ body }) => {
      if (!findEntity('subcategories', body.subcategoryId)) throw new Error('Subcategory not found');
      const subject = { id: crypto.randomUUID(), ...body };
      db.data.subjects.push(subject);
      await db.write();
      return subject;
    })
    .put('/:id', async ({ params: { id }, body }) => {
      const index = db.data.subjects.findIndex(s => s.id === id);
      if (index === -1) throw new Error('Subject not found');
      db.data.subjects[index] = { ...db.data.subjects[index], ...body };
      await db.write();
      return db.data.subjects[index];
    })
    .delete('/:id', async ({ params: { id } }) => {
      db.data.subjects = db.data.subjects.filter(s => s.id !== id);
      await db.write();
      return { success: true };
    })
  )

  // Chapters
  .group('/admin/chapters', app => app
    .get('/', () => db.data.chapters)
    .post('/', async ({ body }) => {
      if (!findEntity('subjects', body.subjectId)) throw new Error('Subject not found');
      const chapter = { id: crypto.randomUUID(), ...body };
      db.data.chapters.push(chapter);
      await db.write();
      return chapter;
    })
    .put('/:id', async ({ params: { id }, body }) => {
      const index = db.data.chapters.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Chapter not found');
      db.data.chapters[index] = { ...db.data.chapters[index], ...body };
      await db.write();
      return db.data.chapters[index];
    })
    .delete('/:id', async ({ params: { id } }) => {
      db.data.chapters = db.data.chapters.filter(c => c.id !== id);
      await db.write();
      return { success: true };
    })
  )

  // MCQs
  .group('/admin/mcqs', app => app
    .get('/', () => db.data.mcqs)
    .post('/', async ({ body }) => {
      ['categoryId', 'subcategoryId', 'subjectId', 'chapterId'].forEach(field => {
        if (!findEntity(field.replace('Id', '') + 's', body[field])) {
          throw new Error(`${field.replace('Id', '')} not found`);
        }
      });
      
      const mcq = { 
        id: crypto.randomUUID(),
        options: body.options,
        correctAnswer: parseInt(body.correctAnswer),
        marks: parseInt(body.marks),
        negativeMarking: Boolean(body.negativeMarking),
        ...body 
      };
      db.data.mcqs.push(mcq);
      await db.write();
      return mcq;
    })
    .put('/:id', async ({ params: { id }, body }) => {
      const index = db.data.mcqs.findIndex(m => m.id === id);
      if (index === -1) throw new Error('MCQ not found');
      db.data.mcqs[index] = { 
        ...db.data.mcqs[index],
        ...body,
        correctAnswer: parseInt(body.correctAnswer),
        marks: parseInt(body.marks),
        negativeMarking: Boolean(body.negativeMarking)
      };
      await db.write();
      return db.data.mcqs[index];
    })
    .delete('/:id', async ({ params: { id } }) => {
      db.data.mcqs = db.data.mcqs.filter(m => m.id !== id);
      await db.write();
      return { success: true };
    })
  )

  // Students
  .group('/admin/students', app => app
    .get('/', () => db.data.students)
    .post('/', async ({ body }) => {
      const student = {
        id: crypto.randomUUID(),
        quizAttempts: {},
        ...body
      };
      db.data.students.push(student);
      await db.write();
      return student;
    })
    .delete('/:id', async ({ params: { id } }) => {
      db.data.students = db.data.students.filter(s => s.id !== id);
      await db.write();
      return { success: true };
    })
  )

  // Settings
  .group('/admin/settings', app => app
    .get('/', () => db.data.settings)
    .put('/', async ({ body }) => {
      db.data.settings = { ...db.data.settings, ...body };
      await db.write();
      return db.data.settings;
    })
  )

  // User Endpoints
  .get('/categories', () => db.data.categories)
  .get('/subcategories/:categoryId', ({ params: { categoryId } }) => 
    filterEntities('subcategories', 'categoryId', categoryId))
  .get('/subjects/:subcategoryId', ({ params: { subcategoryId } }) => 
    filterEntities('subjects', 'subcategoryId', subcategoryId))
  .get('/chapters/:subjectId', ({ params: { subjectId } }) => 
    filterEntities('chapters', 'subjectId', subjectId))
  .get('/mcqs/:chapterId', ({ params: { chapterId } }) => 
    filterEntities('mcqs', 'chapterId', chapterId))

  // Quiz Submission
  .post('/submit-quiz', async ({ body }) => {
    const { chapterId, studentAnswers, studentId } = body;
    const mcqs = filterEntities('mcqs', 'chapterId', chapterId);
    let totalMarks = 0;
    const results = {};

    mcqs.forEach(mcq => {
      const selected = studentAnswers[mcq.id];
      const isCorrect = selected === mcq.correctAnswer;
      
      results[mcq.id] = {
        correct: isCorrect,
        correctAnswer: mcq.correctAnswer,
        selectedAnswer: selected,
        marks: mcq.marks
      };

      if (isCorrect) {
        totalMarks += mcq.marks;
      } else if (mcq.negativeMarking || db.data.settings.negativeMarkingGlobal) {
        totalMarks -= mcq.marks * 0.25;
      }
    });

    if (studentId) {
      const student = findEntity('students', studentId);
      if (student) {
        student.quizAttempts[chapterId] = {
          marksObtained: totalMarks,
          timestamp: new Date().toISOString()
        };
        await db.write();
      }
    }

    return { totalMarks, results };
  })

  .listen(3000, () => console.log('Server running on http://localhost:3000'));

export default app;
