import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyTaskReminderComponent } from './daily-task-reminder.component';

describe('DailyTaskReminderComponent', () => {
  let component: DailyTaskReminderComponent;
  let fixture: ComponentFixture<DailyTaskReminderComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DailyTaskReminderComponent],
    });
    fixture = TestBed.createComponent(DailyTaskReminderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
