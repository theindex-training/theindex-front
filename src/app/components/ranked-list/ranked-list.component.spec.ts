import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../../i18n/language.service';
import { RankedListComponent } from './ranked-list.component';

describe('RankedListComponent', () => {
  it('scales bars to the largest value and renders rank, label and count', async () => {
    const fixture = TestBed.createComponent(RankedListComponent);
    fixture.componentRef.setInput('title', 'Top weekdays');
    fixture.componentRef.setInput('countKey', 'stats.trainingsCount');
    fixture.componentRef.setInput('items', [
      { label: 'Monday', value: 12 },
      { label: 'Thursday', value: 3 }
    ]);
    await fixture.whenStable();

    const component = fixture.componentInstance;
    expect(component.barWidth(12)).toBe(100);
    expect(component.barWidth(3)).toBe(25);

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('li');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Monday');
    expect(rows[0].textContent).toContain('12 trainings');
  });

  it('pluralizes the count in Bulgarian', async () => {
    const language = TestBed.inject(LanguageService);
    language.use('bg').subscribe();
    const fixture = TestBed.createComponent(RankedListComponent);
    fixture.componentRef.setInput('title', 'Top gyms');
    fixture.componentRef.setInput('countKey', 'stats.trainingsCount');
    fixture.componentRef.setInput('items', [
      { label: 'West', value: 1 },
      { label: 'East', value: 5 }
    ]);
    await fixture.whenStable();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('li');
    expect(rows[0].textContent).toContain('1 тренировка');
    expect(rows[1].textContent).toContain('5 тренировки');
    language.use('en').subscribe();
  });

  it('shows the empty message when there are no items', async () => {
    const fixture = TestBed.createComponent(RankedListComponent);
    fixture.componentRef.setInput('title', 'Top gyms');
    fixture.componentRef.setInput('items', []);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No data available.');
    expect(fixture.componentInstance.barWidth(0)).toBe(0);
  });
});
