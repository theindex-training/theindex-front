import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import {
  CashRegisterState,
  CashRegisterTransaction,
} from '../../services/cash-register.service';
import { CashRegisterComponent } from './cash-register.component';

const copy = en.cashRegister;
const STATE_URL = '/api/cash-register';
const MANUAL_URL = '/api/cash-register/transactions/manual';

function transaction(
  overrides: Partial<CashRegisterTransaction> = {},
): CashRegisterTransaction {
  return {
    id: 't1',
    type: 'MANUAL_IN',
    amountCents: 1000,
    balanceAfterCents: 1000,
    sourceType: 'MANUAL',
    sourceId: null,
    notes: null,
    createdAt: '2026-11-01T10:00:00Z',
    sourceDetails: null,
    ...overrides,
  };
}

describe('CashRegisterComponent', () => {
  let fixture: ComponentFixture<CashRegisterComponent>;
  let component: CashRegisterComponent;
  let http: HttpTestingController;
  let page: PageDriver;
  let money: (cents: number) => string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CashRegisterComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const format = TestBed.inject(LocaleFormatService);
    money = (cents) => format.money(cents);
  });

  afterEach(() => http.verify());

  async function render(
    state: CashRegisterState = {
      balanceCents: 12_345,
      transactions: [transaction()],
    },
  ) {
    fixture = TestBed.createComponent(CashRegisterComponent);
    component = fixture.componentInstance;
    page = driver(
      () => fixture.nativeElement,
      () => fixture.whenStable(),
    );
    await page.settle();
    const req = http.expectOne(STATE_URL);
    expect(req.request.method).toBe('GET');
    req.flush(state);
    await page.settle();
  }

  async function addTransaction(
    direction: 'IN' | 'OUT',
    amount: string,
    notes?: string,
  ) {
    await page.select('#cash-direction', direction);
    await page.type('#cash-amount', amount);
    if (notes !== undefined) {
      await page.type('#cash-notes', notes);
    }
    await page.submit('form');
  }

  function expectManualPost() {
    const req = http.expectOne(MANUAL_URL);
    expect(req.request.method).toBe('POST');
    return req;
  }

  describe('loading', () => {
    it('shows the balance and the transactions', async () => {
      await render();

      expect(page.text()).toContain(money(12_345));
      expect(page.text()).toContain(en.enums.cashTransactionType.MANUAL_IN);
    });

    it('shows a negative balance', async () => {
      await render({ balanceCents: -2_050, transactions: [] });

      expect(page.text()).toContain(money(-2_050));
      expect(page.text()).toContain(copy.emptyTitle);
    });

    it('shows the error state and reloads on "Try again"', async () => {
      fixture = TestBed.createComponent(CashRegisterComponent);
      page = driver(
        () => fixture.nativeElement,
        () => fixture.whenStable(),
      );
      await page.settle();
      const error = apiError(undefined, 500);
      http.expectOne(STATE_URL).flush(error.body, error.options);
      await page.settle();

      expect(page.text()).toContain(copy.loadError);
      expect(page.text()).toContain(copy.loadErrorMessage);

      const retry = page
        .queryAll('button')
        .find((button) => button.textContent?.includes(en.common.tryAgain))!;
      retry.click();
      await page.settle();
      http.expectOne(STATE_URL).flush({ balanceCents: 0, transactions: [] });
      await page.settle();

      expect(page.text()).not.toContain(copy.loadError);
    });
  });

  describe('manual transaction', () => {
    beforeEach(() => render());

    it('posts the direction, the amount in cents and the trimmed notes', async () => {
      await addTransaction('OUT', '12.34', '  float top-up  ');

      expect(expectManualPost().request.body).toEqual({
        direction: 'OUT',
        amountCents: 1234,
        notes: 'float top-up',
      });
    });

    it('leaves out notes that are blank', async () => {
      await addTransaction('IN', '20', '   ');

      // What goes over the wire: the payload holds notes: undefined, which JSON drops.
      const wire = JSON.parse(
        expectManualPost().request.serializeBody() as string,
      );
      expect(wire).toEqual({ direction: 'IN', amountCents: 2000 });
      expect('notes' in wire).toBe(false);
    });

    it('converts euros to cents without floating-point drift', async () => {
      await addTransaction('IN', '19.99');

      expect(expectManualPost().request.body.amountCents).toBe(1999);
    });

    it.each([
      ['zero', '0'],
      ['negative', '-5'],
      ['more than two decimals', '12.345'],
    ])('rejects a %s amount', async (_, amount) => {
      await addTransaction('IN', amount);

      http.expectNone(MANUAL_URL);
      expect(page.text()).toContain(copy.amountError);
    });

    it('confirms, resets the form and reloads the balance after saving', async () => {
      await addTransaction('OUT', '12.34', 'float');
      expectManualPost().flush(transaction({ id: 't2', type: 'MANUAL_OUT' }));
      await page.settle();

      http
        .expectOne(STATE_URL)
        .flush({ balanceCents: 11_111, transactions: [] });
      await page.settle();

      expect(page.text()).toContain(copy.created);
      expect(page.text()).toContain(money(11_111));
      expect(component.form.getRawValue()).toEqual({
        direction: 'IN',
        amount: 0,
        notes: '',
      });
      expect(component.form.touched).toBe(false);
    });

    it('ignores a second submit while the first is saving', async () => {
      await addTransaction('IN', '10');
      await page.submit('form');

      expect(http.match(MANUAL_URL).length).toBe(1);
    });

    it('shows the API error and keeps what was typed', async () => {
      await addTransaction('OUT', '500', 'safe');
      const error = apiError('Insufficient balance');
      expectManualPost().flush(error.body, error.options);
      await page.settle();

      expect(page.alert()).toBe('Insufficient balance');
      expect(component.form.getRawValue()).toEqual({
        direction: 'OUT',
        amount: 500,
        notes: 'safe',
      });
      expect(page.text()).toContain(copy.add);
    });

    it('falls back to a generic error', async () => {
      await addTransaction('IN', '5');
      const error = apiError(undefined, 500);
      expectManualPost().flush(error.body, error.options);
      await page.settle();

      expect(page.alert()).toBe(copy.createError);
    });
  });

  describe('transaction details', () => {
    beforeEach(() => render());

    it('describes a settlement payout by its period', () => {
      const format = TestBed.inject(LocaleFormatService);
      const payout = transaction({
        type: 'SETTLEMENT_OUT',
        sourceType: 'SETTLEMENT',
        sourceDetails: { periodStart: '2026-10-01', periodEnd: '2026-10-31' },
      });

      expect(component.formatTransactionDetails(payout)).toBe(
        `Settlement period: ${format.date('2026-10-01')} → ${format.date('2026-10-31')}`,
      );
      expect(
        component.formatTransactionDetails({
          ...payout,
          sourceDetails: { periodStart: '2026-10-01' },
        }),
      ).toBe(copy.settlementTransaction);
    });

    it('describes a subscription purchase by buyer, plan and type', () => {
      const sale = transaction({
        type: 'SUBSCRIPTION_IN',
        sourceType: 'SUBSCRIPTION',
        sourceDetails: {
          boughtBy: {
            traineeId: 'tr1',
            name: 'Ivan Petrov',
            nickname: ' Vanko ',
          },
          planTitle: '10 visits',
          subscriptionType: 'PUNCH',
        },
      });

      expect(component.formatTransactionDetails(sale)).toBe(
        `Bought by Ivan Petrov (Vanko) • Plan: 10 visits • Type: ${en.enums.planType.PUNCH}`,
      );
      expect(component.formatSubscriptionDetailSuffix(sale)).toBe(
        ` • Plan: 10 visits • Type: ${en.enums.planType.PUNCH}`,
      );
      expect(component.formatSubscriptionBuyerPath(sale)).toEqual([
        '/trainees',
        'tr1',
      ]);
    });

    it('humanizes an unknown subscription type and falls back when details are empty', () => {
      const sale = transaction({
        sourceType: 'SUBSCRIPTION',
        sourceDetails: { subscriptionType: 'FAMILY_PASS' },
      });
      expect(component.formatTransactionDetails(sale)).toBe(
        'Type: Family Pass',
      );

      const bare = transaction({
        sourceType: 'SUBSCRIPTION',
        sourceDetails: {},
      });
      expect(component.formatTransactionDetails(bare)).toBe(
        copy.subscriptionPurchase,
      );
      expect(component.formatSubscriptionBuyerLabel(bare)).toBe(
        copy.unknownTrainee,
      );
      expect(component.formatSubscriptionBuyerPath(bare)).toEqual([
        '/trainees',
      ]);
    });

    it('shows "-" for manual entries and missing details', () => {
      expect(
        component.formatTransactionDetails(transaction({ sourceDetails: {} })),
      ).toBe('-');
      expect(
        component.formatTransactionDetails(
          transaction({ sourceType: 'SETTLEMENT' }),
        ),
      ).toBe('-');
    });

    it('labels known transaction types and humanizes unknown ones', () => {
      expect(component.formatTransactionType('MANUAL_OUT')).toBe(
        en.enums.cashTransactionType.MANUAL_OUT,
      );
      expect(component.formatTransactionType('REFUND_OUT')).toBe('Refund Out');
    });
  });
});
