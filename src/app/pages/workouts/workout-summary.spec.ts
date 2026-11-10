import {
  hasSummaryText,
  summaryFromEditor,
  summaryLineText,
} from './workout-summary';

describe('workout summary helpers', () => {
  it('summaryLineText: tags dropped, line breaks kept as new lines, entities decoded', () => {
    expect(
      summaryLineText(
        '<b>3 rounds</b>&nbsp; for time<br>400-m run <i>easy</i><br/>&amp; go',
      ),
    ).toBe('3 rounds for time\n400-m run easy\n& go');
    expect(summaryLineText('<b> </b><br>')).toBe('');
  });

  it('summaryFromEditor: paragraphs only, empty ones left out, ids and version kept', () => {
    expect(
      summaryFromEditor({
        time: 1731200000000,
        version: '2.31.0',
        blocks: [
          { id: 'a1', type: 'paragraph', data: { text: '<b>AMRAP 12:</b>' } },
          { id: 'a2', type: 'paragraph', data: { text: '<br>' } },
          {
            id: 'a3',
            type: 'header',
            data: { text: 'Not a paragraph', level: 2 },
          },
          { id: 'a4', type: 'paragraph', data: { text: '5 burpees' } },
        ],
      }),
    ).toEqual({
      time: 1731200000000,
      version: '2.31.0',
      blocks: [
        { id: 'a1', type: 'paragraph', data: { text: '<b>AMRAP 12:</b>' } },
        { id: 'a4', type: 'paragraph', data: { text: '5 burpees' } },
      ],
    });
  });

  it('hasSummaryText: some text in some paragraph', () => {
    expect(hasSummaryText(null)).toBe(false);
    expect(hasSummaryText({ blocks: [] })).toBe(false);
    expect(
      hasSummaryText({
        blocks: [{ type: 'paragraph', data: { text: '<i></i>' } }],
      }),
    ).toBe(false);
    expect(
      hasSummaryText({
        blocks: [{ type: 'paragraph', data: { text: 'Fran' } }],
      }),
    ).toBe(true);
  });
});
