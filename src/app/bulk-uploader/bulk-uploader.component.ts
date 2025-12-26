import { Component, ElementRef, ViewChild } from '@angular/core';
import { FirebaseTaskService } from '../services/firebase-task.service';
import { Task } from '../models/task.model';

@Component({
  selector: 'app-bulk-uploader',
  templateUrl: './bulk-uploader.component.html',
  styleUrls: ['./bulk-uploader.component.scss'],
})
export class BulkUploaderComponent {
  @ViewChild('logScrollContainer') private logContainer!: ElementRef;

  tasks: Task[] = [];
  statusMessage = 'No file selected.';
  isUploading = false;
  uploadProgress = 0;
  logs: { message: string; type: 'info' | 'success' | 'error' }[] = [];
  successCount = 0;
  errorCount = 0;

  constructor(private taskService: FirebaseTaskService) {}

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const content = e.target?.result as string;
        this.tasks = JSON.parse(content);
        this.statusMessage = `Ready to upload ${this.tasks.length} tasks.`;
        this.log(`File loaded. Found ${this.tasks.length} tasks.`, 'success');
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.log(`Error parsing JSON: ${errorMessage}`, 'error');
        this.statusMessage = 'Error parsing JSON file.';
      }
    };
    reader.readAsText(file);
  }

  async startUpload(): Promise<void> {
    if (this.tasks.length === 0) return;

    this.isUploading = true;
    this.uploadProgress = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.log('Starting bulk upload...', 'info');

    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.tasks[i];
      try {
        const taskData = { ...task };
        const taskId = task.id;
        delete (taskData as any).id;

        // Convert dueDate string to Date object if necessary
        if (taskData.dueDate && typeof taskData.dueDate === 'string') {
          taskData.dueDate = new Date(taskData.dueDate);
        }

        await this.taskService.setTask(taskId, taskData);
        this.successCount++;
        this.uploadProgress = Math.round(((i + 1) / this.tasks.length) * 100);
        this.statusMessage = `Progress: ${i + 1}/${this.tasks.length} (${this.uploadProgress}%)`;
      } catch (err: any) {
        console.error(err);
        this.log(`Failed to upload ${task.title || task.id}: ${err.message}`, 'error');
        this.errorCount++;
      }

      // Add a small delay every few uploads to avoid hitting rate limits too hard (though Firestore is robust)
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.log(
      `Upload complete! Success: ${this.successCount}, Failed: ${this.errorCount}`,
      'success'
    );
    this.isUploading = false;
    this.statusMessage = 'Upload Finished';
  }

  log(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    this.logs.push({
      message: `[${new Date().toLocaleTimeString()}] ${message}`,
      type,
    });

    // Scroll to bottom after view updates
    setTimeout(() => this.scrollToBottom(), 100);
  }

  private scrollToBottom(): void {
    if (this.logContainer) {
      this.logContainer.nativeElement.scrollTop = this.logContainer.nativeElement.scrollHeight;
    }
  }
}
