import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import en from '../../../../public/i18n/en.json';
import { PageDriver, driver } from '../../../testing/dom';
import { ContactFieldsComponent } from './contact-fields.component';
import { ContactForm, contactForm, fillContactForm } from './contact-form';

@Component({
  standalone: true,
  imports: [ContactFieldsComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<app-contact-fields [form]="form" idPrefix="c" />`,
})
class HostComponent {
  form: ContactForm = contactForm({ phoneRequired: false });
}

describe('ContactFieldsComponent social profiles', () => {
  let fixture: ComponentFixture<HostComponent>;
  let page: PageDriver;

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    page = driver(
      () => fixture.nativeElement as HTMLElement,
      () => fixture.whenStable(),
    );
    await page.settle();
  });

  const form = () => fixture.componentInstance.form;
  const help = (network: string) =>
    page.query(`#c-${network}-help`)?.textContent?.replace(/\s+/g, ' ').trim();
  const warning = (network: string) =>
    page.query(`[data-testid="contact-social-warning-${network}"]`);

  /** Types into the field without leaving it (no blur). */
  async function typeOnly(network: string, value: string) {
    const input = page.query<HTMLInputElement>(`#c-${network}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await page.settle();
  }

  it('shows each network on its own line with its logo and hint', () => {
    const fields = page.queryAll('.contact-social');
    expect(
      fields.map((f) => f.querySelector('label')?.textContent?.trim()),
    ).toEqual(['Instagram', 'Facebook', 'TikTok']);
    for (const field of fields) {
      expect(field.querySelector('app-social-icon svg path')).not.toBeNull();
      expect(
        field.querySelector('app-social-icon')?.getAttribute('aria-hidden'),
      ).toBe('true');
    }
    expect(help('instagram')).toBe(en.contact.socialHint);
  });

  it('shows the address and an Open link once the value looks like a profile', async () => {
    await typeOnly('instagram', '@ivan.p');

    expect(help('instagram')).toBe('instagram.com/ivan.p');
    const open = page.query<HTMLAnchorElement>('.contact-social__open')!;
    expect(open.href).toBe('https://www.instagram.com/ivan.p');
    expect(open.target).toBe('_blank');
    expect(open.rel).toBe('noopener noreferrer');
    expect(open.getAttribute('aria-label')).toBe(
      'Open the Instagram profile in a new tab',
    );
  });

  it('tidies a pasted profile link to its handle when the field is left', async () => {
    await page.type(
      '#c-tiktok',
      ' https://www.tiktok.com/@ivan.trains?_t=8abc&_r=1 ',
    );

    expect(form().controls.tiktok.value).toBe('@ivan.trains');
    expect(page.query<HTMLInputElement>('#c-tiktok')!.value).toBe(
      '@ivan.trains',
    );
    expect(help('tiktok')).toBe('tiktok.com/@ivan.trains');
  });

  it('warns at once about a link to another network, and still lets the form save', async () => {
    await typeOnly('facebook', 'https://www.instagram.com/ivan.p/');

    expect(warning('facebook')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'This link goes to Instagram, not Facebook. ' +
        en.contact.socialStillSaved,
    );
    expect(page.query('.contact-social__open')).toBeNull();
    expect(form().valid).toBe(true);

    // Leaving the field keeps what was typed.
    await page.type('#c-facebook', 'https://www.instagram.com/ivan.p/');
    expect(form().controls.facebook.value).toBe(
      'https://www.instagram.com/ivan.p/',
    );
  });

  it('waits until the field is left before warning about a handle', async () => {
    await typeOnly('facebook', 'iva');
    expect(warning('facebook')).toBeNull();
    expect(help('facebook')).toBe(en.contact.socialHint);

    await page.type('#c-facebook', 'iva');
    expect(help('facebook')).toBe(
      `${en.contact.socialWarnings.handle.facebook} ${en.contact.socialStillSaved}`,
    );
    expect(page.query('#c-facebook')?.getAttribute('aria-invalid')).toBe(
      'false',
    );
    expect(form().valid).toBe(true);
  });

  it('warns about a stored value straight away', async () => {
    fillContactForm(form(), {
      instagram: 'https://www.instagram.com/p/C1abc/',
    });
    await page.settle();

    expect(warning('instagram')?.textContent).toContain(
      'This link goes to a post or a page on Instagram, not to a profile.',
    );
  });

  it('still shows the 200-character limit as an error', async () => {
    await page.type('#c-instagram', 'x'.repeat(201));

    expect(help('instagram')).toBe(en.contact.socialError);
    expect(page.query('#c-instagram')?.getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(form().valid).toBe(false);
  });
});
