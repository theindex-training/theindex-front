import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { AccountView } from '../../services/accounts.service';
import { AccountsComponent } from './accounts.component';

function account(id: string, extra: Partial<AccountView> = {}): AccountView {
  return {
    id,
    email: `${id}@example.com`,
    role: 'TRAINEE',
    status: 'ACTIVE',
    createdAt: '2026-11-10T08:00:00.000Z',
    consentAt: '2026-11-10T08:00:00.000Z',
    registration: {
      name: `Person ${id}`,
      phone: '0888 123 456',
      gymSubscription: null,
      preferredGym: null,
      instagram: null,
      facebook: null,
      tiktok: null,
    },
    profile: null,
    ...extra,
  };
}

describe('AccountsComponent', () => {
  let fixture: ComponentFixture<AccountsComponent>;
  let http: HttpTestingController;
  let page: PageDriver;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AccountsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AccountsComponent);
    page = driver(
      () => fixture.nativeElement as HTMLElement,
      () => fixture.whenStable(),
    );
    await page.settle();
  });

  afterEach(() => http.verify());

  const expectList = (link: string): TestRequest =>
    http.expectOne(
      (r) => r.url === '/api/accounts' && r.params.get('link') === link,
    );

  const tableRows = () =>
    page
      .queryAll('tbody tr')
      .map((row) => row.textContent.replace(/\s+/g, ' ').trim());

  it('asks for the accounts not connected yet by default, and links each to its page', async () => {
    expectList('unlinked').flush([account('a1'), account('a2')]);
    await page.settle();

    expect(
      page.query<HTMLInputElement>('input[type="radio"]:checked')!
        .parentElement!.textContent,
    ).toContain(en.accountsAdmin.filter.unlinked);
    expect(tableRows()).toHaveLength(2);
    expect(tableRows()[0]).toContain('Person a1');
    expect(tableRows()[0]).toContain('a1@example.com');
    expect(tableRows()[0]).toContain(en.accountsAdmin.notConnected);
    expect(
      page.query<HTMLAnchorElement>('tbody a.cell-link')!.getAttribute('href'),
    ).toBe('/accounts/a1');
  });

  it('reloads for the chosen filter and names the connected profile', async () => {
    expectList('unlinked').flush([]);
    await page.settle();
    expect(page.text()).toContain(en.accountsAdmin.list.empty.unlinked);

    const linked = page
      .queryAll<HTMLInputElement>('input[type="radio"]')
      .find((radio) =>
        radio.parentElement!.textContent.includes(
          en.accountsAdmin.filter.linked,
        ),
      )!;
    linked.click();
    await page.settle();

    expectList('linked').flush([
      account('a3', {
        profile: {
          type: 'trainer',
          id: 't1',
          name: 'Petar',
          nickname: null,
          isActive: true,
        },
      }),
    ]);
    await page.settle();
    expect(tableRows()[0]).toContain('Trainer: Petar');
  });

  it('searches the loaded accounts by name, email or phone', async () => {
    expectList('unlinked').flush([
      account('a1'),
      account('a2', {
        registration: { ...account('a2').registration!, phone: '0899 555' },
      }),
    ]);
    await page.settle();

    await page.type('input[type="search"]', '555');
    expect(tableRows()).toHaveLength(1);
    expect(tableRows()[0]).toContain('Person a2');

    await page.type('input[type="search"]', 'nobody');
    expect(page.text()).toContain(en.accountsAdmin.list.noMatchesTitle);
  });

  it('shows the error with Try again', async () => {
    const { body, options } = apiError('Boom', 500);
    expectList('unlinked').flush(body, options);
    await page.settle();
    expect(page.text()).toContain(en.accountsAdmin.list.loadError);

    const retry = page
      .queryAll<HTMLButtonElement>('button')
      .find((b) => b.textContent?.trim() === en.common.tryAgain)!;
    retry.click();
    await page.settle();
    expectList('unlinked').flush([]);
  });
});
