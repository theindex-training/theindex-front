import { firstValueFrom, of } from 'rxjs';
import {
  DeletedRecordError,
  recordLoadError,
  rejectDeleted,
} from './deleted-record.util';

describe('rejectDeleted', () => {
  it('passes an active record through', async () => {
    const record = { id: 'a', isActive: true };
    await expect(
      firstValueFrom(of(record).pipe(rejectDeleted())),
    ).resolves.toBe(record);
  });

  it('fails for an inactive (deleted) record', async () => {
    await expect(
      firstValueFrom(of({ id: 'a', isActive: false }).pipe(rejectDeleted())),
    ).rejects.toBeInstanceOf(DeletedRecordError);
  });
});

describe('recordLoadError', () => {
  it('answers the not-found key for a deleted record', () => {
    expect(
      recordLoadError(new DeletedRecordError(), 'x.notFound', 'x.load'),
    ).toEqual({ key: 'x.notFound', params: undefined });
  });

  it("shows the API's message, or the fallback, for other errors", () => {
    expect(
      recordLoadError(
        { error: { message: 'Trainee not found' } },
        'x.notFound',
        'x.load',
      ),
    ).toEqual({ text: 'Trainee not found' });
    expect(recordLoadError({ status: 0 }, 'x.notFound', 'x.load')).toEqual({
      key: 'x.load',
      params: undefined,
    });
  });
});
