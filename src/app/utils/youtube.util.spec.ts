import { youtubeVideoId } from './youtube.util';

describe('youtubeVideoId', () => {
  it.each([
    'https://www.youtube.com/watch?v=rMvwVtlqjTE',
    'https://youtube.com/watch?v=rMvwVtlqjTE&t=42s',
    'https://m.youtube.com/watch?feature=share&v=rMvwVtlqjTE',
    'https://youtu.be/rMvwVtlqjTE?si=abc',
    'https://www.youtube.com/embed/rMvwVtlqjTE?autoplay=1',
    'https://www.youtube.com/shorts/rMvwVtlqjTE',
    '  https://WWW.YOUTUBE.COM/watch?v=rMvwVtlqjTE ',
  ])('%s -> rMvwVtlqjTE', (link) => {
    expect(youtubeVideoId(link)).toBe('rMvwVtlqjTE');
  });

  it.each([
    'rMvwVtlqjTE',
    'https://vimeo.com/123456789',
    'https://www.crossfit.com/essentials/the-air-squat',
    'https://www.youtube.com/channel/UCtcQ6TPwXAYgZ1Mcl3M1vng',
    'https://www.youtube.com/watch?v=short',
    'https://youtube.com.evil.example/watch?v=rMvwVtlqjTE',
    'javascript:alert(1)//youtu.be/rMvwVtlqjTE',
  ])('refuses %s', (link) => {
    expect(youtubeVideoId(link)).toBeNull();
  });
});
