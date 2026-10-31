import { TestBed } from '@angular/core/testing';
import { RankedListComponent } from './ranked-list.component';

describe('RankedListComponent', () => {
  it('scales bars to the largest value and renders rank, label and count', async () => {
    const fixture = TestBed.createComponent(RankedListComponent);
    fixture.componentRef.setInput('title', 'Top weekdays');
    fixture.componentRef.setInput('unit', 'trainings');
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

  it('shows the empty message when there are no items', async () => {
    const fixture = TestBed.createComponent(RankedListComponent);
    fixture.componentRef.setInput('title', 'Top gyms');
    fixture.componentRef.setInput('items', []);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No data available.');
    expect(fixture.componentInstance.barWidth(0)).toBe(0);
  });
});
