import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

/**
 * Tableau de bord recruteur — placeholder (Épic 0, squelette de navigation uniquement).
 * Le contenu métier (profil structure, offres publiées, liste de candidats validée)
 * arrive en Épic 3 et suivants.
 */
@Component({
  selector: 'app-recruteur-dashboard',
  imports: [MatCardModule],
  templateUrl: './dashboard.html',
})
export class RecruteurDashboard {}
