import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Layout de l'espace recruteur (accès protégé par `roleGuard('recruteur')`, voir
 * `app.routes.ts`). Mobile-first : une colonne, header collant en haut, contenu qui ne
 * déborde jamais horizontalement. Porte la navigation interne persistante vers le tableau de
 * bord, le profil et les offres — seul moyen d'atteindre ces écrans (voir `recruteur.routes.ts`).
 */
@Component({
  selector: 'app-recruteur-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatIconModule],
  templateUrl: './recruteur-layout.html',
})
export class RecruteurLayout {}
