import { TestBed } from '@angular/core/testing';
import { SegmentedControlComponent } from './segmented-control.component';

describe('SegmentedControlComponent', () => {
  it('renders one radio per option, checks the current value and emits changes', async () => {
    const fixture = TestBed.createComponent(SegmentedControlComponent<'all' | 'active'>);
    fixture.componentRef.setInput('label', 'Status');
    fixture.componentRef.setInput('options', [
      { value: 'all', label: 'All' },
      { value: 'active', label: 'Active' }
    ]);
    fixture.componentRef.setInput('value', 'all');
    await fixture.whenStable();

    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe(value => emitted.push(value));

    const radios = fixture.nativeElement.querySelectorAll('input[type=radio]') as NodeListOf<HTMLInputElement>;
    expect(radios.length).toBe(2);
    expect(radios[0].checked).toBe(true);
    expect(radios[0].name).toBe(radios[1].name);
    expect(fixture.nativeElement.querySelector('legend').textContent.trim()).toBe('Status');

    radios[1].click();
    expect(emitted).toEqual(['active']);

    // Re-selecting the current value doesn't emit again.
    fixture.componentInstance.select('active');
    expect(emitted).toEqual(['active']);
  });
});
