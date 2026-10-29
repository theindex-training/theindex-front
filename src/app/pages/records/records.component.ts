import { Component } from '@angular/core';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';

@Component({
  selector: 'app-records',
  standalone: true,
  imports: [EmptyStateComponent, PageHeaderComponent],
  templateUrl: './records.component.html'
})
export class RecordsComponent {}
