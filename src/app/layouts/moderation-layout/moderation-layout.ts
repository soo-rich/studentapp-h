import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';

/**
 * Layout du back-office modération (accès protégé par `roleGuard('moderateur')`, voir
 * `app.routes.ts`). Mobile-first comme le reste du produit (voir CLAUDE.md) même si ce
 * back-office est probablement aussi consulté depuis un desktop.
 */
@Component({
  selector: 'app-moderation-layout',
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatIconModule],
  templateUrl: './moderation-layout.html',
})
export class ModerationLayout {}
