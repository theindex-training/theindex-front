import { Component } from '@angular/core';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-records',
  standalone: true,
  imports: [TranslocoPipe, EmptyStateComponent, PageHeaderComponent],
  templateUrl: './records.component.html'
})
export class RecordsComponent {}
