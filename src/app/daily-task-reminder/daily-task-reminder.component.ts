import { Component, OnInit, OnDestroy } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { FirebaseTaskService } from '../services/firebase-task.service';
import { Task } from '../models/task.model';
import { Subscription } from 'rxjs';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasTask: boolean;
}

@Component({
  selector: 'app-daily-task-reminder',
  templateUrl: './daily-task-reminder.component.html',
  styleUrls: ['./daily-task-reminder.component.scss'],
  animations: [
    trigger('cardHover', [
      state('default', style({ transform: 'translateY(0)' })),
      state('hover', style({ transform: 'translateY(-5px)' })),
      transition('default <=> hover', animate('200ms ease-in-out')),
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('200ms ease-in', style({ opacity: 0 }))]),
    ]),
    trigger('slideUp', [
      transition(':enter', [
        style({ transform: 'translateY(100%)' }),
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ transform: 'translateY(100%)' })),
      ]),
    ]),
  ],
})
export class DailyTaskReminderComponent implements OnInit, OnDestroy {
  buildMarker = 'restored_v1';
  currentDate: Date = new Date();
  selectedFilter = 'all';
  notificationPermission = 'default';
  private notificationCheckInterval: ReturnType<typeof setInterval> | null = null;

  tasks: Task[] = [];
  filteredTasks: Task[] = [];

  // Calendar data
  weekDays: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  calendarDays: CalendarDay[] = [];
  currentMonth = '';
  currentMonthIndex: number = new Date().getMonth();
  currentYear: number = new Date().getFullYear();

  // Selected date for calendar
  selectedDate: Date = new Date();
  selectedDateTasks: Task[] = [];

  // Modal state
  showTaskModal = false;
  editingTask = false;
  newTask: Task = {
    id: '',
    title: '',
    description: '',
    dueDate: new Date(),
    dueDateString: this.formatDateForInput(new Date()),
    dueTime: '09:00',
    priority: 'medium',
    status: 'pending',
    notificationEnabled: true,
  };

  // Mobile navigation state
  activeTab = 'dashboard';
  Math = Math;

  // Toast State
  toast: { show: boolean; message: string; type: 'success' | 'error' | 'info' } = {
    show: false,
    message: '',
    type: 'info',
  };

  private tasksSubscription?: Subscription;

  constructor(
    private swPush: SwPush,
    private firebaseTaskService: FirebaseTaskService
  ) {
    this.checkNotificationSupport();
  }

  ngOnInit(): void {
    this.loadTasks();
    this.requestNotificationPermission();
    this.startNotificationChecks();
  }

  ngOnDestroy(): void {
    if (this.notificationCheckInterval) {
      clearInterval(this.notificationCheckInterval);
    }
    if (this.tasksSubscription) {
      this.tasksSubscription.unsubscribe();
    }
  }

  loadTasks(): void {
    console.log('DailyTaskReminderComponent: Loading tasks...');
    this.tasksSubscription = this.firebaseTaskService.getTasks().subscribe({
      next: tasks => {
        console.log('DailyTaskReminderComponent: Received tasks:', tasks.length);
        this.tasks = tasks.map(t => ({
          ...t,
          dueDate:
            t.dueDate && typeof t.dueDate.toDate === 'function'
              ? t.dueDate.toDate()
              : new Date(t.dueDate),
        }));
        this.filterTasks();
        this.generateCalendar();
        this.updateSelectedDateTasks();
      },
      error: err => {
        console.error('DailyTaskReminderComponent: Error loading tasks:', err);
        alert('Failed to load tasks. Check console for details.');
      },
    });
  }

  // Notification Methods
  checkNotificationSupport(): void {
    if ('Notification' in window) {
      this.notificationPermission = Notification.permission;
    }
  }

  async requestNotificationPermission(): Promise<void> {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      this.notificationPermission = permission;
    }
  }

  startNotificationChecks(): void {
    this.notificationCheckInterval = setInterval(() => {
      this.checkTaskNotifications();
    }, 10000); // Check every 10 seconds for better precision

    this.checkTaskNotifications();
  }

  checkTaskNotifications(): void {
    const now = new Date();

    this.tasks.forEach(task => {
      if (!task.notificationEnabled || task.status === 'completed') return;

      const taskDateTime = this.combineDateTime(task.dueDate, task.dueTime);
      const timeDiff = taskDateTime.getTime() - now.getTime();

      // 10 minutes warning: between 9 and 11 minutes
      if (timeDiff > 540000 && timeDiff <= 660000 && !task.notified10m) {
        this.showNotification(task, '10 minutes');
        this.firebaseTaskService.updateTask(task.id, { notified10m: true });
      }

      // Final due warning: within 60 seconds of due time
      if (Math.abs(timeDiff) < 60000 && !task.notifiedNow) {
        this.showNotification(task, 'now');
        this.firebaseTaskService.updateTask(task.id, { notifiedNow: true });
      }
    });
  }

  combineDateTime(date: Date, time: string): Date {
    const combined = new Date(date);
    const [hours, minutes] = time.split(':');
    combined.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    return combined;
  }

  showNotification(task: Task, when: string): void {
    if (this.notificationPermission !== 'granted') return;

    const title = when === 'now' ? `Task Due Now: ${task.title}` : `Upcoming Task: ${task.title}`;
    const body = when === 'now' ? `${task.description}` : `Due in ${when}: ${task.description}`;

    const options: NotificationOptions = {
      body,
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/icon-72x72.png',
      tag: `task-${task.id}`,
      requireInteraction: true,
      data: { taskId: task.id },
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(registration => {
          registration.showNotification(title, options);
        })
        .catch(err => {
          console.error('Service Worker notification error:', err);
          const _notification = new Notification(title, options);
        });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _notification = new Notification(title, options);
    }
  }

  selectTab(tab: string): void {
    console.log('Switching to tab:', tab);
    this.activeTab = tab;
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    this.toast = { show: true, message, type };
    setTimeout(() => {
      this.toast.show = false;
    }, 4000);
  }

  getTaskCountByStatus(status: string): number {
    return this.tasks.filter(task => task.status === status).length;
  }

  filterTasks(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfWeek = new Date();
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);

    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    switch (this.selectedFilter) {
      case 'today':
        this.filteredTasks = this.tasks.filter(task => {
          const taskDate = new Date(task.dueDate);
          taskDate.setHours(0, 0, 0, 0);
          return taskDate.getTime() === today.getTime();
        });
        break;
      case 'week':
        this.filteredTasks = this.tasks.filter(task => {
          const taskDate = new Date(task.dueDate);
          return taskDate >= today && taskDate <= endOfWeek;
        });
        break;
      case 'month':
        this.filteredTasks = this.tasks.filter(task => {
          const taskDate = new Date(task.dueDate);
          return taskDate >= today && taskDate <= endOfMonth;
        });
        break;
      default:
        this.filteredTasks = [...this.tasks];
        break;
    }

    this.filteredTasks.sort((a, b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }

  toggleTaskStatus(task: Task): void {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    this.firebaseTaskService.updateTask(task.id, { status: newStatus });
  }

  editTask(task: Task): void {
    this.newTask = { ...task };
    this.newTask.dueDateString = this.formatDateForInput(task.dueDate);
    this.editingTask = true;
    this.showTaskModal = true;
  }

  deleteTask(id: string): void {
    if (confirm('Are you sure you want to delete this task?')) {
      this.firebaseTaskService.deleteTask(id).then(() => {
        this.showToast('Task deleted successfully', 'error');
        this.closeTaskModal();
      });
    }
  }

  confirmDeleteAll(): void {
    if (this.tasks.length === 0) {
      this.showToast('No tasks to delete', 'info');
      return;
    }

    if (
      confirm(
        'PERMANENT ACTION: Are you sure you want to delete ALL tasks? This cannot be undone.'
      )
    ) {
      const taskIds = this.tasks.map(t => t.id!).filter(id => !!id);
      this.firebaseTaskService
        .deleteAllTasks(taskIds)
        .then(() => {
          this.showToast(`Cleared ${taskIds.length} adventures!`, 'error');
        })
        .catch(err => {
          console.error('Error deleting all tasks:', err);
          this.showToast('Failed to clear tasks', 'error');
        });
    }
  }

  openTaskModal(): void {
    this.resetNewTask();
    this.editingTask = false;
    this.showTaskModal = true;
  }

  resetNewTask(): void {
    this.newTask = {
      id: '',
      title: '',
      description: '',
      dueDate: new Date(),
      dueDateString: this.formatDateForInput(new Date()),
      dueTime: '09:00',
      priority: 'medium',
      status: 'pending',
      notificationEnabled: true,
    };
  }

  closeTaskModal(): void {
    this.showTaskModal = false;
  }

  saveTask(): void {
    const taskDate = new Date(this.newTask.dueDateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(taskDate);
    dueDate.setHours(0, 0, 0, 0);

    let finalStatus = this.newTask.status;
    if (dueDate < today && finalStatus !== 'completed') {
      finalStatus = 'overdue';
    }

    const taskData: Omit<Task, 'id'> = {
      title: this.newTask.title,
      description: this.newTask.description,
      dueDate: taskDate,
      dueDateString: this.newTask.dueDateString,
      dueTime: this.newTask.dueTime,
      priority: this.newTask.priority,
      status: finalStatus,
      notificationEnabled: this.newTask.notificationEnabled,
    };

    console.log('DailyTaskReminderComponent: Saving task data:', taskData);

    if (this.editingTask && this.newTask.id) {
      this.firebaseTaskService
        .updateTask(this.newTask.id, taskData)
        .then(() => {
          console.log('DailyTaskReminderComponent: Task updated successfully');
          this.showToast('Task updated successfully!');
          this.closeTaskModal();
          this.resetNewTask();
        })
        .catch(err => {
          console.error('DailyTaskReminderComponent: Error updating task:', err);
          this.showToast('Error updating task', 'error');
        });
    } else {
      this.firebaseTaskService
        .addTask(taskData)
        .then(() => {
          console.log('DailyTaskReminderComponent: Task added successfully');
          this.showToast('Task created! Ready for adventure?');
          this.closeTaskModal();
          this.resetNewTask();
        })
        .catch(err => {
          console.error('DailyTaskReminderComponent: Error adding task:', err);
          this.showToast('Error adding task', 'error');
        });
    }
  }

  generateCalendar(): void {
    this.calendarDays = [];

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    this.currentMonth = `${monthNames[this.currentMonthIndex]} ${this.currentYear}`;

    const firstDay = new Date(this.currentYear, this.currentMonthIndex, 1);
    const lastDay = new Date(this.currentYear, this.currentMonthIndex + 1, 0);
    const firstDayOfWeek = firstDay.getDay();
    const prevMonthLastDay = new Date(this.currentYear, this.currentMonthIndex, 0).getDate();

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(this.currentYear, this.currentMonthIndex - 1, prevMonthLastDay - i);
      this.calendarDays.push({
        date: date,
        isCurrentMonth: false,
        isToday: this.isToday(date),
        hasTask: this.hasTaskOnDate(date),
      });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(this.currentYear, this.currentMonthIndex, i);
      this.calendarDays.push({
        date: date,
        isCurrentMonth: true,
        isToday: this.isToday(date),
        hasTask: this.hasTaskOnDate(date),
      });
    }

    const totalCells = 42;
    const nextMonthDays = totalCells - this.calendarDays.length;

    for (let i = 1; i <= nextMonthDays; i++) {
      const date = new Date(this.currentYear, this.currentMonthIndex + 1, i);
      this.calendarDays.push({
        date: date,
        isCurrentMonth: false,
        isToday: this.isToday(date),
        hasTask: this.hasTaskOnDate(date),
      });
    }
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  hasTaskOnDate(date: Date): boolean {
    const dateString = date.toDateString();
    return this.tasks.some(task => {
      const taskDate = new Date(task.dueDate);
      return taskDate.toDateString() === dateString;
    });
  }

  previousMonth(): void {
    this.currentMonthIndex--;
    if (this.currentMonthIndex < 0) {
      this.currentMonthIndex = 11;
      this.currentYear--;
    }
    this.generateCalendar();
  }

  nextMonth(): void {
    this.currentMonthIndex++;
    if (this.currentMonthIndex > 11) {
      this.currentMonthIndex = 0;
      this.currentYear++;
    }
    this.generateCalendar();
  }

  selectDate(date: Date): void {
    this.selectedDate = date;
    this.updateSelectedDateTasks();
  }

  selectDateOnKey(event: KeyboardEvent, date: Date): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectDate(date);
    }
  }

  updateSelectedDateTasks(): void {
    const selectedDateString = this.selectedDate.toDateString();
    this.selectedDateTasks = this.tasks.filter(task => {
      const taskDate = new Date(task.dueDate);
      return taskDate.toDateString() === selectedDateString;
    });

    this.selectedDateTasks.sort((a, b) => {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
