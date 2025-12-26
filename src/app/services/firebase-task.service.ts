import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  orderBy,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Task } from '../models/task.model';

@Injectable({
  providedIn: 'root',
})
export class FirebaseTaskService {
  private collectionPath = 'tasks';

  constructor(private firestore: Firestore) {}

  getTasks(): Observable<Task[]> {
    const tasksCollection = collection(this.firestore, this.collectionPath);
    const q = query(tasksCollection, orderBy('dueDate', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Task[]>;
  }

  addTask(task: Omit<Task, 'id'>): Promise<any> {
    const tasksCollection = collection(this.firestore, this.collectionPath);
    return addDoc(tasksCollection, {
      ...task,
      createdAt: task.createdAt || new Date(),
    } as any);
  }

  updateTask(taskId: string, data: Partial<Task>): Promise<void> {
    const taskDoc = doc(this.firestore, `${this.collectionPath}/${taskId}`);
    return updateDoc(taskDoc, data);
  }

  deleteTask(taskId: string): Promise<void> {
    const taskDoc = doc(this.firestore, `${this.collectionPath}/${taskId}`);
    return deleteDoc(taskDoc);
  }

  setTask(taskId: string, task: Partial<Task>): Promise<void> {
    const taskDoc = doc(this.firestore, `${this.collectionPath}/${taskId}`);
    return setDoc(taskDoc, {
      ...task,
      createdAt: task.createdAt || new Date(),
    });
  }

  deleteAllTasks(taskIds: string[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    taskIds.forEach(id => {
      const taskDoc = doc(this.firestore, `${this.collectionPath}/${id}`);
      batch.delete(taskDoc);
    });
    return batch.commit();
  }
}
