import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import en from '../../../../public/i18n/en.json';
import { UiInputComponent } from './ui-input.component';

@Component({
  imports: [ReactiveFormsModule, UiInputComponent],
  template: `<app-ui-input
    id="pw"
    label="Password"
    [type]="type"
    [formControl]="control"
  />`,
})
class HostComponent {
  type: 'text' | 'password' = 'password';
  control = new FormControl<string | null>('secret');
}

describe('UiInputComponent', () => {
  async function render(type: 'text' | 'password' = 'password') {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.type = type;
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    return {
      fixture,
      host: fixture.componentInstance,
      input: el.querySelector<HTMLInputElement>('input')!,
      toggle: () => el.querySelector<HTMLButtonElement>('button'),
      el,
    };
  }

  it('puts the id on the inner input, so the label points at it', async () => {
    const { el, input } = await render();

    expect(input.id).toBe('pw');
    expect(el.querySelectorAll('#pw').length).toBe(1);
    expect(el.querySelector('label')!.getAttribute('for')).toBe('pw');
  });

  it('shows the form value and writes typed text back to the form control', async () => {
    const { fixture, host, input } = await render('text');
    expect(input.value).toBe('secret');

    input.value = 'changed';
    input.dispatchEvent(new Event('input'));
    expect(host.control.value).toBe('changed');

    host.control.setValue(null);
    await fixture.whenStable();
    expect(input.value).toBe('');
  });

  it('marks the control touched on blur and follows its disabled state', async () => {
    const { fixture, host, input } = await render('text');
    expect(host.control.touched).toBe(false);

    input.dispatchEvent(new Event('blur'));
    expect(host.control.touched).toBe(true);

    host.control.disable();
    await fixture.whenStable();
    expect(input.disabled).toBe(true);
  });

  it('lets the user show and hide a password', async () => {
    const { fixture, input, toggle } = await render('password');
    expect(input.type).toBe('password');
    expect(toggle()!.getAttribute('aria-label')).toBe(en.common.showPassword);

    toggle()!.click();
    await fixture.whenStable();
    expect(input.type).toBe('text');
    expect(toggle()!.getAttribute('aria-label')).toBe(en.common.hidePassword);

    toggle()!.click();
    await fixture.whenStable();
    expect(input.type).toBe('password');
  });

  it('has no show/hide button for other fields', async () => {
    const { toggle } = await render('text');

    expect(toggle()).toBeNull();
  });
});
