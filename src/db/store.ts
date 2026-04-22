import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';

export interface Student {
  id: string;
  name: string;
  age: string;
  level: string;
  curriculum: string;
  createdAt: number;
}

export interface Lesson {
  id: string;
  studentId: string;
  date: number;
  progress: string;
  topicsCovered: string;
  nextSteps: string;
  createdAt: number;
}

export interface Target {
  id: string;
  studentId: string;
  title: string;
  status: 'active' | 'completed';
  createdAt: number;
  completedAt?: number;
}

const db = localforage.createInstance({
  name: 'TutorTrack'
});

export const store = {
  async getStudents(): Promise<Student[]> {
    const students = await db.getItem<Student[]>('students');
    return students || [];
  },
  async getStudent(id: string): Promise<Student | undefined> {
    const students = await this.getStudents();
    return students.find(s => s.id === id);
  },
  async saveStudent(student: Omit<Student, 'id' | 'createdAt'>): Promise<Student> {
    const students = await this.getStudents();
    const newStudent: Student = {
      ...student,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    await db.setItem('students', [...students, newStudent]);
    return newStudent;
  },
  async getLessons(studentId: string): Promise<Lesson[]> {
    const lessons = await db.getItem<Lesson[]>('lessons');
    const all = lessons || [];
    return all.filter((l) => l.studentId === studentId).sort((a, b) => b.date - a.date);
  },
  async saveLesson(lesson: Omit<Lesson, 'id' | 'createdAt'>): Promise<Lesson> {
    const lessons = await db.getItem<Lesson[]>('lessons');
    const all = lessons || [];
    const newLesson: Lesson = {
      ...lesson,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    await db.setItem('lessons', [...all, newLesson]);
    return newLesson;
  },
  async updateLesson(id: string, updates: Partial<Omit<Lesson, 'id' | 'createdAt'>>): Promise<Lesson | null> {
    const lessons = await db.getItem<Lesson[]>('lessons');
    if (!lessons) return null;
    const all = lessons || [];
    const idx = all.findIndex(l => l.id === id);
    if (idx === -1) return null;
    
    const updatedLesson = {
      ...all[idx],
      ...updates
    };
    
    all[idx] = updatedLesson;
    await db.setItem('lessons', all);
    return updatedLesson;
  },
  async getTargets(studentId: string): Promise<Target[]> {
    const targets = await db.getItem<Target[]>('targets');
    const all = targets || [];
    return all.filter((t) => t.studentId === studentId).sort((a, b) => b.createdAt - a.createdAt);
  },
  async saveTarget(target: Omit<Target, 'id' | 'createdAt'>): Promise<Target> {
    const targets = await db.getItem<Target[]>('targets');
    const all = targets || [];
    const newTarget: Target = {
      ...target,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    await db.setItem('targets', [...all, newTarget]);
    return newTarget;
  },
  async updateTarget(id: string, updates: Partial<Omit<Target, 'id' | 'createdAt'>>): Promise<Target | null> {
    const targets = await db.getItem<Target[]>('targets');
    if (!targets) return null;
    const all = targets || [];
    const idx = all.findIndex(t => t.id === id);
    if (idx === -1) return null;
    
    const updatedTarget = {
      ...all[idx],
      ...updates
    };
    
    all[idx] = updatedTarget;
    await db.setItem('targets', all);
    return updatedTarget;
  }
};
