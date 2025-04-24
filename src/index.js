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
const existsWithName = (collection, name, parentField = null, parentId = null, excludeId = null) => {
const items = parentField 
    ? db.data[collection].filter(item => item[parentField] === parentId)
    : db.data[collection];
  return items.some(item => 
    item.name.toLowerCase() === name.toLowerCase() && item.id !== excludeId
  );
};
                  

const app = new Elysia()
  // Error handling middleware
  .onError(({ code, error }) => {
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: code === 'NOT_FOUND' ? 404 : 400,
      headers: { 'Content-Type': 'application/json' }
    });
  })

  // Admin Endpoints
  // Categories
  .group('/admin/categories', app => app
    .get('/', () => ({ success: true, data: db.data.categories }))
    .post('/', async ({ body }) => {
      if (!body.name?.trim()) throw new Error('Category name is required');
      const name = body.name.trim();
      
      if (existsWithName('categories', name)) {
        throw new Error('Category with this name already exists');
      }
      
      const category = { id: crypto.randomUUID(), name };
      db.data.categories.push(category);
      await db.write();
      return { success: true, data: category };
    })
    .put('/:id', async ({ params: { id }, body }) => {
      if (!body.name?.trim()) throw new Error('Category name is required');
      const name = body.name.trim();
      
      const index = db.data.categories.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Category not found');
      
      if (existsWithName('categories', name, null, null, id)) {
        throw new Error('Another category with this name already exists');
      }
      
      db.data.categories[index].name = name;
      await db.write();
      return { success: true, data: db.data.categories[index] };
    })
    .delete('/:id', async ({ params: { id } }) => {
      const category = findEntity('categories', id);
      if (!category) throw new Error('Category not found');
      
      if (db.data.subcategories.some(s => s.categoryId === id)) {
        throw new Error('Cannot delete category with existing subcategories');
      }
      
      db.data.categories = db.data.categories.filter(c => c.id !== id);
      await db.write();
      return { success: true };
    })
  )

  // Subcategories
  .group('/admin/subcategories', app => app
    .get('/', () => ({ success: true, data: db.data.subcategories }))
    .post('/', async ({ body }) => {
      if (!body.name?.trim()) throw new Error('Subcategory name is required');
      if (!body.categoryId) throw new Error('Category ID is required');
      
      const name = body.name.trim();
      const category = findEntity('categories', body.categoryId);
      if (!category) throw new Error('Category not found');
      
      if (existsWithName('subcategories', name, 'categoryId', body.categoryId)) {
        throw new Error('Subcategory with this name already exists in this category');
      }
      
      const subcategory = { 
        id: crypto.randomUUID(), 
        name,
        categoryId: body.categoryId
      };
      
      db.data.subcategories.push(subcategory);
      await db.write();
      return { success: true, data: subcategory };
    })
    .put('/:id', async ({ params: { id }, body }) => {
      if (!body.name?.trim()) throw new Error('Subcategory name is required');
      if (!body.categoryId) throw new Error('Category ID is required');
      
      const name = body.name.trim();
      const index = db.data.subcategories.findIndex(s => s.id === id);
      if (index === -1) throw new Error('Subcategory not found');
      
      const category = findEntity('categories', body.categoryId);
      if (!category) throw new Error('Category not found');
      
      if (existsWithName('subcategories', name, 'categoryId', body.categoryId, id)) {
        throw new Error('Another subcategory with this name already exists in this category');
      }
      
      db.data.subcategories[index] = { 
        ...db.data.subcategories[index], 
        name,
        categoryId: body.categoryId
      };
      await db.write();
      return { success: true, data: db.data.subcategories[index] };
    })
    .delete('/:id', async ({ params: { id } }) => {
      const subcategory = findEntity('subcategories', id);
      if (!subcategory) throw new Error('Subcategory not found');
      
      if (db.data.subjects.some(s => s.subcategoryId === id)) {
        throw new Error('Cannot delete subcategory with existing subjects');
      }
      
      db.data.subcategories = db.data.subcategories.filter(s => s.id !== id);
      await db.write();
      return { success: true };
    })
  )

  // Subjects
  .group('/admin/subjects', app => app
    .get('/', () => ({ success: true, data: db.data.subjects }))
    .post('/', async ({ body }) => {
      if (!body.name?.trim()) throw new Error('Subject name is required');
      if (!body.subcategoryId) throw new Error('Subcategory ID is required');
      
      const name = body.name.trim();
      const subcategory = findEntity('subcategories', body.subcategoryId);
      if (!subcategory) throw new Error('Subcategory not found');
      
      if (existsWithName('subjects', name, 'subcategoryId', body.subcategoryId)) {
        throw new Error('Subject with this name already exists in this subcategory');
      }
      
      const subject = { 
        id: crypto.randomUUID(), 
        name,
        subcategoryId: body.subcategoryId
      };
      
      db.data.subjects.push(subject);
      await db.write();
      return { success: true, data: subject };
    })
    .put('/:id', async ({ params: { id }, body }) => {
      if (!body.name?.trim()) throw new Error('Subject name is required');
      if (!body.subcategoryId) throw new Error('Subcategory ID is required');
      
      const name = body.name.trim();
      const index = db.data.subjects.findIndex(s => s.id === id);
      if (index === -1) throw new Error('Subject not found');
      
      const subcategory = findEntity('subcategories', body.subcategoryId);
      if (!subcategory) throw new Error('Subcategory not found');
      
      if (existsWithName('subjects', name, 'subcategoryId', body.subcategoryId, id)) {
        throw new Error('Another subject with this name already exists in this subcategory');
      }
      
      db.data.subjects[index] = { 
        ...db.data.subjects[index], 
        name,
        subcategoryId: body.subcategoryId
      };
      await db.write();
      return { success: true, data: db.data.subjects[index] };
    })
    .delete('/:id', async ({ params: { id } }) => {
      const subject = findEntity('subjects', id);
      if (!subject) throw new Error('Subject not found');
      
      if (db.data.chapters.some(c => c.subjectId === id)) {
        throw new Error('Cannot delete subject with existing chapters');
      }
      
      db.data.subjects = db.data.subjects.filter(s => s.id !== id);
      await db.write();
      return { success: true };
    })
  )

  // Chapters
  .group('/admin/chapters', app => app
    .get('/', () => ({ success: true, data: db.data.chapters }))
    .post('/', async ({ body }) => {
      if (!body.name?.trim()) throw new Error('Chapter name is required');
      if (!body.subjectId) throw new Error('Subject ID is required');
      
      const name = body.name.trim();
      const subject = findEntity('subjects', body.subjectId);
      if (!subject) throw new Error('Subject not found');
      
      if (existsWithName('chapters', name, 'subjectId', body.subjectId)) {
        throw new Error('Chapter with this name already exists in this subject');
      }
      
      const chapter = { 
        id: crypto.randomUUID(), 
        name,
        subjectId: body.subjectId
      };
      
      db.data.chapters.push(chapter);
      await db.write();
      return { success: true, data: chapter };
    })
    .put('/:id', async ({ params: { id }, body }) => {
      if (!body.name?.trim()) throw new Error('Chapter name is required');
      if (!body.subjectId) throw new Error('Subject ID is required');
      
      const name = body.name.trim();
      const index = db.data.chapters.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Chapter not found');
      
      const subject = findEntity('subjects', body.subjectId);
      if (!subject) throw new Error('Subject not found');
      
      if (existsWithName('chapters', name, 'subjectId', body.subjectId, id)) {
        throw new Error('Another chapter with this name already exists in this subject');
      }
      
      db.data.chapters[index] = { 
        ...db.data.chapters[index], 
        name,
        subjectId: body.subjectId
      };
      await db.write();
      return { success: true, data: db.data.chapters[index] };
    })
    .delete('/:id', async ({ params: { id } }) => {
      const chapter = findEntity('chapters', id);
      if (!chapter) throw new Error('Chapter not found');
      
      if (db.data.mcqs.some(m => m.chapterId === id)) {
        throw new Error('Cannot delete chapter with existing MCQs');
      }
      
      db.data.chapters = db.data.chapters.filter(c => c.id !== id);
      await db.write();
      return { success: true };
    })
  )

  // MCQs
  .group('/admin/mcqs', app => app
    .get('/', () => ({ success: true, data: db.data.mcqs }))
    .post('/', async ({ body }) => {
      const requiredFields = [
        'question', 'options', 'correctAnswer', 'marks',
        'categoryId', 'subcategoryId', 'subjectId', 'chapterId'
      ];
      
      for (const field of requiredFields) {
        if (!body[field] && body[field] !== 0) {
          throw new Error(`${field} is required`);
        }
      }
      
      if (!Array.isArray(body.options) || body.options.length !== 4) {
        throw new Error('Exactly 4 options are required');
      }
      
      if (body.options.some(opt => !opt?.trim())) {
        throw new Error('All options must have text');
      }
      
      if (body.correctAnswer < 0 || body.correctAnswer > 3) {
        throw new Error('Correct answer must be between 0 and 3');
      }
      
      if (body.marks <= 0) {
        throw new Error('Marks must be a positive number');
      }
      
      // Validate hierarchy
      if (!findEntity('categories', body.categoryId)) throw new Error('Category not found');
      if (!findEntity('subcategories', body.subcategoryId)) throw new Error('Subcategory not found');
      if (!findEntity('subjects', body.subjectId)) throw new Error('Subject not found');
      if (!findEntity('chapters', body.chapterId)) throw new Error('Chapter not found');
      
      const mcq = { 
        id: crypto.randomUUID(),
        question: body.question.trim(),
        options: body.options.map(opt => opt.trim()),
        correctAnswer: parseInt(body.correctAnswer),
        marks: parseInt(body.marks),
        negativeMarking: Boolean(body.negativeMarking),
        categoryId: body.categoryId,
        subcategoryId: body.subcategoryId,
        subjectId: body.subjectId,
        chapterId: body.chapterId
      };
      
      db.data.mcqs.push(mcq);
      await db.write();
      return { success: true, data: mcq };
    })
    .put('/:id', async ({ params: { id }, body }) => {
      const index = db.data.mcqs.findIndex(m => m.id === id);
      if (index === -1) throw new Error('MCQ not found');
      
      const requiredFields = [
        'question', 'options', 'correctAnswer', 'marks',
        'categoryId', 'subcategoryId', 'subjectId', 'chapterId'
      ];
      
      for (const field of requiredFields) {
        if (!body[field] && body[field] !== 0) {
          throw new Error(`${field} is required`);
        }
      }
      
      if (!Array.isArray(body.options) || body.options.length !== 4) {
        throw new Error('Exactly 4 options are required');
      }
      
      if (body.options.some(opt => !opt?.trim())) {
        throw new Error('All options must have text');
      }
      
      if (body.correctAnswer < 0 || body.correctAnswer > 3) {
        throw new Error('Correct answer must be between 0 and 3');
      }
      
      if (body.marks <= 0) {
        throw new Error('Marks must be a positive number');
      }
      
      // Validate hierarchy
      if (!findEntity('categories', body.categoryId)) throw new Error('Category not found');
      if (!findEntity('subcategories', body.subcategoryId)) throw new Error('Subcategory not found');
      if (!findEntity('subjects', body.subjectId)) throw new Error('Subject not found');
      if (!findEntity('chapters', body.chapterId)) throw new Error('Chapter not found');
      
      const updatedMcq = {
        ...db.data.mcqs[index],
        question: body.question.trim(),
        options: body.options.map(opt => opt.trim()),
        correctAnswer: parseInt(body.correctAnswer),
        marks: parseInt(body.marks),
        negativeMarking: Boolean(body.negativeMarking),
        categoryId: body.categoryId,
        subcategoryId: body.subcategoryId,
        subjectId: body.subjectId,
        chapterId: body.chapterId
      };
      
      db.data.mcqs[index] = updatedMcq;
      await db.write();
      return { success: true, data: updatedMcq };
    })
    .delete('/:id', async ({ params: { id } }) => {
      const mcq = findEntity('mcqs', id);
      if (!mcq) throw new Error('MCQ not found');
      
      db.data.mcqs = db.data.mcqs.filter(m => m.id !== id);
      await db.write();
      return { success: true };
    })
  )

  // Students
  .group('/admin/students', app => app
    .get('/', () => ({ success: true, data: db.data.students }))
    .post('/', async ({ body }) => {
      if (!body.name?.trim()) throw new Error('Student name is required');
      if (!body.email?.trim()) throw new Error('Email is required');
      if (!body.course?.trim()) throw new Error('Course is required');
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email.trim())) {
        throw new Error('Invalid email format');
      }
      
      const student = {
        id: crypto.randomUUID(),
        name: body.name.trim(),
        email: body.email.trim(),
        course: body.course.trim(),
        quizAttempts: {}
      };
      
      db.data.students.push(student);
      await db.write();
      return { success: true, data: student };
    })
    .delete('/:id', async ({ params: { id } }) => {
      const student = findEntity('students', id);
      if (!student) throw new Error('Student not found');
      
      db.data.students = db.data.students.filter(s => s.id !== id);
      await db.write();
      return { success: true };
    })
  )

  // Settings
  .group('/admin/settings', app => app
    .get('/', () => ({ success: true, data: db.data.settings }))
    .put('/', async ({ body }) => {
      if (typeof body.negativeMarkingGlobal !== 'boolean') {
        throw new Error('Invalid value for negativeMarkingGlobal');
      }
      
      db.data.settings.negativeMarkingGlobal = body.negativeMarkingGlobal;
      await db.write();
      return { success: true, data: db.data.settings };
    })
  )

  // User Endpoints
  .get('/categories', () => ({ success: true, data: db.data.categories }))
  .get('/subcategories/:categoryId', ({ params: { categoryId } }) => ({
    success: true,
    data: filterEntities('subcategories', 'categoryId', categoryId)
  }))
  .get('/subjects/:subcategoryId', ({ params: { subcategoryId } }) => ({
    success: true,
    data: filterEntities('subjects', 'subcategoryId', subcategoryId)
  }))
  .get('/chapters/:subjectId', ({ params: { subjectId } }) => ({
    success: true,
    data: filterEntities('chapters', 'subjectId', subjectId)
  }))
  .get('/mcqs/:chapterId', ({ params: { chapterId } }) => ({
    success: true,
    data: filterEntities('mcqs', 'chapterId', chapterId)
  }))

  // Quiz Submission
  .post('/submit-quiz', async ({ body }) => {
    const { chapterId, studentAnswers, studentId } = body;
    
    if (!chapterId) throw new Error('Chapter ID is required');
    if (!studentAnswers || typeof studentAnswers !== 'object') {
      throw new Error('Invalid student answers');
    }
    
    const mcqs = filterEntities('mcqs', 'chapterId', chapterId);
    if (mcqs.length === 0) throw new Error('No MCQs found for this chapter');
    
    let totalMarks = 0;
    let totalPossible = 0;
    const results = {};
    
    mcqs.forEach(mcq => {
      totalPossible += mcq.marks;
      const selected = studentAnswers[mcq.id];
      const isCorrect = selected === mcq.correctAnswer;
      
      results[mcq.id] = {
        correct: isCorrect,
        correctAnswer: mcq.correctAnswer,
        selectedAnswer: selected,
        marks: mcq.marks,
        question: mcq.question,
        options: mcq.options
      };
      
      if (isCorrect) {
        totalMarks += mcq.marks;
      } else if (mcq.negativeMarking || db.data.settings.negativeMarkingGlobal) {
        totalMarks -= mcq.marks * 0.25;
      }
    });
    
    // Record attempt if student ID provided
    if (studentId) {
      const student = findEntity('students', studentId);
      if (student) {
        student.quizAttempts[chapterId] = {
          marksObtained: totalMarks,
          totalPossible,
          timestamp: new Date().toISOString()
        };
        await db.write();
      }
    }
    
    return { 
      success: true,
      data: { 
        totalMarks,
        totalPossible,
        results 
      }
    };
  })

  .listen(9216, () => console.log('Server running on http://localhost:9216'));

export default app;
