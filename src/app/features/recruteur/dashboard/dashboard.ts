import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

/**
 * Tableau de bord recruteur (Épic 3) : point d'entrée de l'espace recruteur, avec des liens
 * de navigation vers le profil de structure et les offres — c'est le seul moyen d'atteindre
 * ces écrans (voir `recruteur-layout.html` pour la navigation persistante dans l'entête).
 */
@Component({
  selector: 'app-recruteur-dashboard',
  imports: [MatIconModule, RouterLink],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecruteurDashboard {}
