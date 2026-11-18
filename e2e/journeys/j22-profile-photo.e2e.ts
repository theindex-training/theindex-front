import { Page } from '@playwright/test';
import { myProfile } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/**
 * J22: a trainee without a photo (initials in the navigation) uploads one from My details: picks a
 * picture, turns it a quarter, saves the square (sent with the picture as form fields), and sees
 * it on the page and in the navigation. Then adjusts the crop of the kept picture (the saved
 * square comes back and is sent as JSON) and removes the photo (initials again).
 */
test.describe('J22 profile photo', () => {
  const MEDIA = 'https://media.e2e.test/profile-photos';
  const photo = (id: string, crop: object) => ({
    url: `${MEDIA}/${id}/s512.webp`,
    thumbnailUrl: `${MEDIA}/${id}/s128.webp`,
    crop,
    updatedAt: '2026-11-18T10:00:00.000Z',
  });

  /** A 600×400 JPEG drawn by the browser itself. */
  async function picture(page: Page): Promise<Buffer> {
    const dataUrl = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 400;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#3a6ea5';
      ctx.fillRect(0, 0, 600, 400);
      ctx.fillStyle = '#f1c27d';
      ctx.beginPath();
      ctx.arc(300, 200, 120, 0, Math.PI * 2);
      ctx.fill();
      return canvas.toDataURL('image/jpeg', 0.9);
    });
    return Buffer.from(dataUrl.split(',')[1], 'base64');
  }

  /** The multipart form fields of a recorded request body. */
  function formFields(body: unknown): Record<string, string> {
    const fields: Record<string, string> = {};
    const pattern = /name="([^"]+)"\r\n\r\n([^\r]*)\r\n/g;
    for (const [, name, value] of String(body).matchAll(pattern)) {
      fields[name] = value;
    }
    return fields;
  }

  test(
    'uploads, turns and crops a photo, adjusts it and removes it',
    {
      tag: '@desktop',
    },
    async ({ page, api, signInAs }) => {
      const section = page.getByTestId('profile-photo');
      const navAvatar = page
        .getByTestId('user-avatar')
        .filter({ visible: true });
      const button = (key: string) =>
        section.getByRole('button', { name: t(key), exact: true });

      let current: object | null = null;
      api.on('GET', '/api/auth/register/options', {
        body: { gyms: [], gymSubscriptions: [] },
      });
      api.on('GET', '/api/my-profile', () => ({
        body: myProfile({ photo: current }),
      }));
      api.on('PUT', '/api/my-profile/photo', () => {
        current = photo('p1', {
          x: 0,
          y: 0.166667,
          width: 1,
          height: 0.666667,
          rotation: 90,
        });
        return { body: current };
      });
      api.on('PATCH', '/api/my-profile/photo', (request) => {
        current = photo('p2', request.body as object);
        return { body: current };
      });
      api.on('DELETE', '/api/my-profile/photo', () => {
        current = null;
        return { status: 204 };
      });

      await signInAs('TRAINEE');
      await page.goto('/my-details');
      await expect(navAvatar).toHaveText('IP');
      const jpeg = await picture(page);
      // The public media host serves the crops.
      await page.route(`${MEDIA}/**`, (route) =>
        route.fulfill({ contentType: 'image/jpeg', body: jpeg }),
      );

      // Upload: pick, turn a quarter right, save the cropper's own square.
      const chooser = page.waitForEvent('filechooser');
      await button('myDetails.photo.upload').click();
      await (
        await chooser
      ).setFiles({
        name: 'me.jpg',
        mimeType: 'image/jpeg',
        buffer: jpeg,
      });
      const save = button('myDetails.photo.save');
      await expect(save).toBeEnabled();
      await button('myDetails.photo.rotateRight').click();
      await expect(save).toBeEnabled();
      await save.click();

      await expect
        .poll(() => api.calls('PUT', '/api/my-profile/photo').length)
        .toBe(1);
      const sent = api.last('PUT', '/api/my-profile/photo')!.body;
      expect(String(sent)).toContain('filename="me.jpg"');
      // Turned, the picture is 400×600: the largest square, centred.
      expect(formFields(sent)).toEqual({
        x: '0',
        y: '0.166667',
        width: '1',
        height: '0.666667',
        rotation: '90',
      });
      await expect(section.getByRole('status')).toHaveText(
        t('myDetails.photo.saved'),
      );
      await expect(
        page.getByTestId('profile-photo-current').locator('img'),
      ).toHaveAttribute('src', `${MEDIA}/p1/s512.webp`);
      await expect(navAvatar.locator('img')).toHaveAttribute(
        'src',
        `${MEDIA}/p1/s128.webp`,
      );
      await expect(navAvatar).toHaveText('');

      // Adjust: the kept picture comes back with the saved square; saving sends it as JSON.
      await page.route('**/api/my-profile/photo/original', (route) =>
        route.fulfill({ contentType: 'image/jpeg', body: jpeg }),
      );
      await button('myDetails.photo.adjust').click();
      await expect(save).toBeEnabled();
      await save.click();
      await expect
        .poll(() => api.calls('PATCH', '/api/my-profile/photo').length)
        .toBe(1);
      const crop = api.last('PATCH', '/api/my-profile/photo')!.body as {
        x: number;
        y: number;
        width: number;
        height: number;
        rotation: number;
      };
      expect(crop.rotation).toBe(90);
      expect(crop.x).toBeCloseTo(0, 2);
      expect(crop.y).toBeCloseTo(0.1667, 2);
      expect(crop.width).toBeCloseTo(1, 2);
      expect(crop.height).toBeCloseTo(0.6667, 2);
      await expect(navAvatar.locator('img')).toHaveAttribute(
        'src',
        `${MEDIA}/p2/s128.webp`,
      );

      // Remove, after confirming: the initials come back.
      page.once('dialog', (dialog) => void dialog.accept());
      await button('myDetails.photo.remove').click();
      await expect(section.getByRole('status')).toHaveText(
        t('myDetails.photo.removed'),
      );
      expect(api.calls('DELETE', '/api/my-profile/photo')).toHaveLength(1);
      await expect(navAvatar).toHaveText('IP');
      await expect(button('myDetails.photo.upload')).toBeVisible();
    },
  );
});
