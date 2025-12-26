export interface Task {
  id: string; // Firestore ID
  title: string;
  description: string;
  dueDate: any; // Date or Timestamp
  dueDateString: string;
  dueTime: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  notificationEnabled: boolean;
  notifiedNow?: boolean;
  notified10m?: boolean;
  createdAt?: any;
}
