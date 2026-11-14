import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  SOCIAL_NETWORKS,
  SocialNetwork,
  socialProfileUrl,
} from '../../utils/contact.util';

/**
 * A profile's social networks as `.detail-list` rows (`<div><dt/><dd/></div>`), one per network
 * given, linked when `socialProfileUrl` can open it. Renders nothing when none is given.
 */
@Component({
  selector: 'app-social-links',
  standalone: true,
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { style: 'display: contents' },
  template: `
    @for (network of given; track network) {
      <div>
        <dt>{{ 'contact.networks.' + network | transloco }}</dt>
        <dd>
          @if (url(network); as href) {
            <a [href]="href" target="_blank" rel="noopener noreferrer">{{
              profile[network]
            }}</a>
          } @else {
            {{ profile[network] }}
          }
        </dd>
      </div>
    }
  `,
})
export class SocialLinksComponent {
  @Input({ required: true }) profile!: Partial<
    Record<SocialNetwork, string | null>
  >;

  get given(): SocialNetwork[] {
    return SOCIAL_NETWORKS.filter((network) => !!this.profile[network]?.trim());
  }

  url(network: SocialNetwork): string | null {
    return socialProfileUrl(network, this.profile[network]);
  }
}
