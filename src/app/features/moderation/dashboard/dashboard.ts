import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

/**
 * Tableau de bord back-office modération — placeholder (Épic 0, squelette de navigation
 * uniquement). La file de validation des profils et l'arbitrage des demandes d'urgence
 * arrivent en Épic 4.
 */
@Component({
  selector: 'app-moderation-dashboard',
  imports: [MatCardModule],
  templateUrl: './dashboard.html',
})
export class ModerationDashboard {}
