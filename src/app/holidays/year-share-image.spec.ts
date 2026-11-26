import { recordingContext } from '../../testing/canvas';
import { YearInReview } from '../services/trainees.service';
import {
  YearShareContent,
  YearShareStyle,
  drawYearShare,
  shareFileName,
  shareRows,
} from './year-share-image';

const YEAR: YearInReview = {
  year: 2026,
  trainings: 96,
  firstTrainingOn: '2026-01-05',
  favouriteTime: { time: '07:00', count: 41 },
  longestStreakWeeks: 12,
  topTrainer: { id: 'tr-1', name: 'Ivan Petrov', count: 50, photoUrl: null },
  busiestMonth: { month: 10, count: 14 },
};

const STYLE: YearShareStyle = {
  background: 'black',
  text: 'grey',
  strong: 'white',
  gold: 'gold',
  border: 'dimgrey',
  sparkles: ['gold', 'red'],
  headingFont: 'Heading',
  bodyFont: 'Body',
};

const CONTENT: YearShareContent = {
  kicker: 'MY 2026 AT THE INDEX',
  figure: '96',
  figureLabel: 'trainings',
  rows: [
    { label: 'FAVOURITE HOUR', value: '07:00' },
    { label: 'COACH OF THE YEAR', value: 'Ivan Petrov' },
  ],
  outro: 'See you at the gym in 2027. Even stronger.',
  site: 'theindex.training',
};

describe('the share picture', () => {
  it('lists what the year has, as the summary does', () => {
    expect(shareRows(YEAR)).toEqual(['time', 'streak', 'trainer', 'month']);
    expect(
      shareRows({
        ...YEAR,
        favouriteTime: null,
        longestStreakWeeks: 1,
        topTrainer: null,
      }),
    ).toEqual(['month']);
  });

  it('is named after the year', () => {
    expect(shareFileName(2026)).toBe('the-index-2026.png');
  });

  it('draws every text, in order', () => {
    const { context, drawn } = recordingContext();
    drawYearShare(context, CONTENT, STYLE, null);
    expect(drawn.map((item) => item.text)).toEqual([
      'MY 2026 AT THE INDEX',
      '96',
      'trainings',
      'FAVOURITE HOUR',
      '07:00',
      'COACH OF THE YEAR',
      'Ivan Petrov',
      'See you at the gym in 2027. Even stronger.',
      'theindex.training',
    ]);
    expect(drawn[1].font).toBe('700 380px Heading');
  });

  it('puts a long name on its own line, and shrinks or cuts one that still doesn’t fit', () => {
    const drawName = (name: string) => {
      const { context, drawn } = recordingContext();
      drawYearShare(
        context,
        { ...CONTENT, rows: [{ label: 'COACH OF THE YEAR', value: name }] },
        STYLE,
        null,
      );
      const [label, value] = [drawn[3], drawn[4]];
      return {
        text: value.text,
        size: Number(/(\d+)px/.exec(value.font)![1]),
        ownLine: value.y > label.y,
      };
    };
    const width = (text: string, size: number) => text.length * size * 0.55;
    // 1080 wide, 96 margins.
    const inner = 1080 - 2 * 96;

    expect(drawName('Ivan Petrov')).toEqual({
      text: 'Ivan Petrov',
      size: 54,
      ownLine: false,
    });

    // Beside the label it would be under 40px: it gets its own line, full size.
    expect(drawName('Desislava Konstantinova')).toEqual({
      text: 'Desislava Konstantinova',
      size: 54,
      ownLine: true,
    });

    const longer = drawName('Desislava-Aleksandrina Konstantinova-Hristova');
    expect(longer.ownLine).toBe(true);
    expect(longer.text).toBe('Desislava-Aleksandrina Konstantinova-Hristova');
    expect(longer.size).toBeLessThan(54);
    expect(width(longer.text, longer.size)).toBeLessThanOrEqual(inner);

    const endless = drawName(
      'Desislava-Aleksandrina Konstantinova-Hristova Petrova-Georgieva-Ivanova',
    );
    expect(endless.size).toBe(28);
    expect(endless.text).toMatch(/^Desislava-Aleksandrina.*…$/);
    expect(width(endless.text, 28)).toBeLessThanOrEqual(inner);
  });
});
