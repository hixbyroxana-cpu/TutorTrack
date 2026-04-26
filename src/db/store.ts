import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { firestore, isFirestoreConfigured } from './firebase';

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

const studentsCollection = firestore ? collection(firestore, 'students') : null;
const lessonsCollection = firestore ? collection(firestore, 'lessons') : null;
const targetsCollection = firestore ? collection(firestore, 'targets') : null;
let canUseFirestore = isFirestoreConfigured;

function disableFirestore(error: unknown, operation: string) {
  console.error(`${operation} failed. Switching to local storage fallback for this session.`, error);
  canUseFirestore = false;
}

async function withFirestoreTimeout<T>(operation: Promise<T>, label: string, timeoutMs = 4000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export const store = {
  async getStudents(): Promise<Student[]> {
    if (studentsCollection && canUseFirestore) {
      try {
        const snapshot = await withFirestoreTimeout(getDocs(studentsCollection), 'getStudents');
        const students = snapshot.docs.map((entry) => entry.data() as Student);
        return students.sort((a, b) => b.createdAt - a.createdAt);
      } catch (error) {
        disableFirestore(error, 'Firestore getStudents');
      }
    }

    const students = await db.getItem<Student[]>('students');
    return students || [];
  },
  async getStudent(id: string): Promise<Student | undefined> {
    if (studentsCollection && canUseFirestore) {
      try {
        const studentRef = doc(studentsCollection, id);
        const studentSnapshot = await withFirestoreTimeout(getDoc(studentRef), 'getStudent');
        if (!studentSnapshot.exists()) return undefined;
        return studentSnapshot.data() as Student;
      } catch (error) {
        disableFirestore(error, 'Firestore getStudent');
      }
    }

    const students = await this.getStudents();
    return students.find(s => s.id === id);
  },
  async saveStudent(student: Omit<Student, 'id' | 'createdAt'>): Promise<Student> {
    const newStudent: Student = {
      ...student,
      id: uuidv4(),
      createdAt: Date.now(),
    };

    if (studentsCollection && canUseFirestore) {
      try {
        await withFirestoreTimeout(setDoc(doc(studentsCollection, newStudent.id), newStudent), 'saveStudent');
        return newStudent;
      } catch (error) {
        disableFirestore(error, 'Firestore saveStudent');
      }
    }

    const students = await this.getStudents();
    await db.setItem('students', [...students, newStudent]);
    return newStudent;
  },
  async getLessons(studentId: string): Promise<Lesson[]> {
    if (lessonsCollection && canUseFirestore) {
      try {
        const lessonsQuery = query(lessonsCollection, where('studentId', '==', studentId));
        const snapshot = await withFirestoreTimeout(getDocs(lessonsQuery), 'getLessons');
        const lessons = snapshot.docs.map((entry) => entry.data() as Lesson);
        return lessons.sort((a, b) => b.date - a.date);
      } catch (error) {
        disableFirestore(error, 'Firestore getLessons');
      }
    }

    const lessons = await db.getItem<Lesson[]>('lessons');
    const all = lessons || [];
    return all.filter((l) => l.studentId === studentId).sort((a, b) => b.date - a.date);
  },
  async saveLesson(lesson: Omit<Lesson, 'id' | 'createdAt'>): Promise<Lesson> {
    const newLesson: Lesson = {
      ...lesson,
      id: uuidv4(),
      createdAt: Date.now(),
    };

    if (lessonsCollection && canUseFirestore) {
      try {
        await withFirestoreTimeout(setDoc(doc(lessonsCollection, newLesson.id), newLesson), 'saveLesson');
        return newLesson;
      } catch (error) {
        disableFirestore(error, 'Firestore saveLesson');
      }
    }

    const lessons = await db.getItem<Lesson[]>('lessons');
    const all = lessons || [];
    await db.setItem('lessons', [...all, newLesson]);
    return newLesson;
  },
  async updateLesson(id: string, updates: Partial<Omit<Lesson, 'id' | 'createdAt'>>): Promise<Lesson | null> {
    if (lessonsCollection && canUseFirestore) {
      try {
        const lessonRef = doc(lessonsCollection, id);
        const lessonSnapshot = await withFirestoreTimeout(getDoc(lessonRef), 'updateLesson.getDoc');
        if (!lessonSnapshot.exists()) return null;

        await withFirestoreTimeout(updateDoc(lessonRef, updates), 'updateLesson.updateDoc');
        return {
          ...(lessonSnapshot.data() as Lesson),
          ...updates,
        };
      } catch (error) {
        disableFirestore(error, 'Firestore updateLesson');
      }
    }

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
    if (targetsCollection && canUseFirestore) {
      try {
        const targetsQuery = query(targetsCollection, where('studentId', '==', studentId));
        const snapshot = await withFirestoreTimeout(getDocs(targetsQuery), 'getTargets');
        const targets = snapshot.docs.map((entry) => entry.data() as Target);
        return targets.sort((a, b) => b.createdAt - a.createdAt);
      } catch (error) {
        disableFirestore(error, 'Firestore getTargets');
      }
    }

    const targets = await db.getItem<Target[]>('targets');
    const all = targets || [];
    return all.filter((t) => t.studentId === studentId).sort((a, b) => b.createdAt - a.createdAt);
  },
  async saveTarget(target: Omit<Target, 'id' | 'createdAt'>): Promise<Target> {
    const newTarget: Target = {
      ...target,
      id: uuidv4(),
      createdAt: Date.now(),
    };

    if (targetsCollection && canUseFirestore) {
      try {
        await withFirestoreTimeout(setDoc(doc(targetsCollection, newTarget.id), newTarget), 'saveTarget');
        return newTarget;
      } catch (error) {
        disableFirestore(error, 'Firestore saveTarget');
      }
    }

    const targets = await db.getItem<Target[]>('targets');
    const all = targets || [];
    await db.setItem('targets', [...all, newTarget]);
    return newTarget;
  },
  async updateTarget(id: string, updates: Partial<Omit<Target, 'id' | 'createdAt'>>): Promise<Target | null> {
    if (targetsCollection && canUseFirestore) {
      try {
        const targetRef = doc(targetsCollection, id);
        const targetSnapshot = await withFirestoreTimeout(getDoc(targetRef), 'updateTarget.getDoc');
        if (!targetSnapshot.exists()) return null;

        await withFirestoreTimeout(updateDoc(targetRef, updates), 'updateTarget.updateDoc');
        return {
          ...(targetSnapshot.data() as Target),
          ...updates
        };
      } catch (error) {
        disableFirestore(error, 'Firestore updateTarget');
      }
    }

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
