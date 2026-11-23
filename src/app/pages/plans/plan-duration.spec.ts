import { durationFields, durationOf, planIncludes } from './plan-duration';

describe('plan-duration', () => {
  it('durationOf reads months first, then days, else the default unit (months)', () => {
    expect(durationOf({ durationDays: null, durationMonths: 3 })).toEqual({
      duration: 3,
      unit: 'MONTHS',
    });
    expect(durationOf({ durationDays: 30, durationMonths: null })).toEqual({
      duration: 30,
      unit: 'DAYS',
    });
    expect(durationOf({ durationDays: null, durationMonths: null })).toEqual({
      duration: null,
      unit: 'MONTHS',
    });
  });

  it('durationFields sends the chosen unit and null for the other', () => {
    expect(durationFields('MONTHS', 1)).toEqual({
      durationDays: null,
      durationMonths: 1,
    });
    expect(durationFields('DAYS', 30)).toEqual({
      durationDays: 30,
      durationMonths: null,
    });
  });

  it('planIncludes names credits, months or days', () => {
    const plan = { credits: null, durationDays: null, durationMonths: null };
    expect(planIncludes({ ...plan, type: 'PUNCH', credits: 10 })).toEqual({
      key: 'plans.fields.creditsCount',
      count: 10,
    });
    expect(planIncludes({ ...plan, type: 'TIME', durationMonths: 1 })).toEqual({
      key: 'plans.fields.monthsCount',
      count: 1,
    });
    expect(planIncludes({ ...plan, type: 'TIME', durationDays: 30 })).toEqual({
      key: 'plans.fields.daysCount',
      count: 30,
    });
  });
});
