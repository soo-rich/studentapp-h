import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

/**
 * Tableau de bord étudiant — squelette de navigation (Épic 0), désormais enrichi de l'accès aux
 * offres publiées et aux candidatures de l'étudiant (Épic 3, parcours d'offres/candidatures) :
 * `/etudiant/offres` (`OfferList`) et `/etudiant/candidatures` (`ApplicationList`), voir
 * `etudiant.routes.ts`. Le reste du contenu métier (profil détaillé, vérification, urgence) est
 * déjà accessible depuis les routes dédiées déclarées dans `app.routes.ts`, hors périmètre de
 * cette tâche.
 */
@Component({
  selector: 'app-etudiant-dashboard',
  imports: [MatButtonModule, MatCardModule, MatIconModule, RouterLink],
  templateUrl: './dashboard.html',
})
export class EtudiantDashboard {}
