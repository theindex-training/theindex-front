import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { makeToken, signInAs } from '../../../testing/jwt';
import { UserBlockComponent } from './user-block.component';

describe('UserBlockComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(UserBlockComponent);
    await fixture.whenStable();
    return {
      fixture,
      component: fixture.componentInstance,
      el: fixture.nativeElement as HTMLElement,
    };
  }

  it('shows the email, its initials and the translated role', async () => {
    signInAs('TRAINER', { email: 'coach.petar@gym.test' });
    const { component, el } = await render();

    expect(component.initials).toBe('CO');
    expect(el.textContent).toContain('coach.petar@gym.test');
    expect(el.textContent).toContain(en.enums.role.TRAINER);
  });

  it('skips non-alphanumeric characters for the initials', async () => {
    signInAs('ADMIN', { email: '_.x9@gym.test' });

    expect((await render()).component.initials).toBe('X9');
  });

  it('falls back to "U", "User" and "Signed in" without an email or role', async () => {
    localStorage.setItem('accessToken', makeToken({}));
    const { component, el } = await render();

    expect(component.initials).toBe('U');
    expect(el.textContent).toContain(en.common.user);
    expect(el.textContent).toContain(en.common.signedIn);
  });

  it('logs out: the token is removed and the app goes to /login', async () => {
    signInAs('ADMIN');
    const { fixture, el } = await render();

    const logOut = Array.from(el.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === en.common.logOut,
    )!;
    logOut.click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('links trainees and trainers to My details, but not admins', async () => {
    const myDetails = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('a')).find(
        (a) => a.textContent?.trim() === en.common.myDetails,
      );

    for (const role of ['TRAINEE', 'TRAINER'] as const) {
      signInAs(role);
      const { el } = await render();
      expect(myDetails(el)?.getAttribute('href')).toBe('/my-details');
    }

    signInAs('ADMIN');
    expect(myDetails((await render()).el)).toBeUndefined();
  });
});
