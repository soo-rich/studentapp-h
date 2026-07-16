import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

/**
 * Tableau de bord étudiant — placeholder (Épic 0, squelette de navigation uniquement).
 * Le contenu métier (profil, candidatures, offres compatibles) arrive en Épic 2 et
 * suivants.
 */
@Component({
  selector: 'app-etudiant-dashboard',
  imports: [MatCardModule],
  templateUrl: './dashboard.html',
})
export class EtudiantDashboard {}
