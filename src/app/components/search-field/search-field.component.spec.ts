import { TestBed } from '@angular/core/testing';
import en from '../../../../public/i18n/en.json';
import { SearchFieldComponent } from './search-field.component';

describe('SearchFieldComponent', () => {
  async function render(value = '') {
    const fixture = TestBed.createComponent(SearchFieldComponent);
    fixture.componentRef.setInput('label', 'Search trainees');
    fixture.componentRef.setInput('value', value);
    await fixture.whenStable();
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((next) =>
      emitted.push(next),
    );
    const el: HTMLElement = fixture.nativeElement;
    return {
      fixture,
      emitted,
      input: el.querySelector<HTMLInputElement>('input')!,
      clear: () =>
        el.querySelector<HTMLButtonElement>(
          `button[aria-label="${en.common.clearSearch}"]`,
        ),
    };
  }

  it('emits on every keystroke', async () => {
    const { input, emitted } = await render();

    input.value = 'iv';
    input.dispatchEvent(new Event('input'));
    input.value = 'iva';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['iv', 'iva']);
  });

  it('clears the term, emits an empty value and keeps focus in the field', async () => {
    const { fixture, input, emitted, clear } = await render('ivan');
    expect(clear()).not.toBeNull();

    clear()!.click();
    await fixture.whenStable();

    expect(emitted).toEqual(['']);
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('gives each field its own id, labelled by the accessible label', async () => {
    const first = await render();
    const second = await render();

    expect(first.input.id).not.toBe(second.input.id);
    const label = first.fixture.nativeElement.querySelector(
      `label[for="${first.input.id}"]`,
    );
    expect(label?.textContent?.trim()).toBe('Search trainees');
  });
});
