import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AccountProvisioningService,
  ProvisionedAccount
} from '../../services/account-provisioning.service';
import { TrainerProfile, TrainersService } from '../../services/trainers.service';

import { displayValue } from '../../utils/display.util';

@Component({
  selector: 'app-trainer-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './trainer-details.component.html',
  styleUrl: './trainer-details.component.scss'
})
export class TrainerDetailsComponent implements OnInit {
  trainer: TrainerProfile | null = null;
  account: ProvisionedAccount | null = null;
  loading = true;
  errorMessage = '';

  constructor(
    private readonly trainersService: TrainersService,
    private readonly accountsService: AccountProvisioningService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'Trainer ID is missing.';
      this.loading = false;
      return;
    }

    this.trainersService.getById(id).subscribe({
      next: (trainer) => {
        this.trainer = trainer;
        this.loading = false;

        if (trainer.accountId) {
          this.loadAccount(trainer.accountId);
        }

        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load this trainer.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  formatNickname(): string {
    return displayValue(this.trainer?.nickname);
  }

  hasLinkedAccount(): boolean {
    return Boolean(this.trainer?.accountId);
  }

  private loadAccount(accountId: string): void {
    this.accountsService.getById(accountId).subscribe({
      next: (account) => {
        this.account = account;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.account = null;
        this.changeDetector.detectChanges();
      }
    });
  }
}
